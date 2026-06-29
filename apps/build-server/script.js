const fs = require('fs')
const path = require('path')
const mime = require('mime-types')
const { exec } = require('child_process')
const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3')
const { Kafka } = require('kafkajs')

const s3Client = new S3Client({
    region: process.env.AWS_REGION || 'ap-south-1',
    ...(process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY
        ? {
            credentials: {
                accessKeyId: process.env.AWS_ACCESS_KEY_ID,
                secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
            },
        }
        : {}),
})

const PROJECT_ID = process.env.PROJECT_ID
const DEPLOYMENT_ID = process.env.DEPLOYMENT_ID
const GIT_REPOSITORY_URL = process.env.GIT_REPOSITORY_URL
const INSTALL_COMMAND = process.env.INSTALL_COMMAND || 'npm install'
const BUILD_COMMAND = process.env.BUILD_COMMAND || 'npm run build'
const OUTPUT_DIR = process.env.OUTPUT_DIR || ''
const ROOT_DIR = (process.env.ROOT_DIR || '/').replace(/^\//, '')

const OUTPUT_CANDIDATES = ['dist', 'out', 'build', 'public']

function resolveOutputDir(buildRoot) {
    if (OUTPUT_DIR) {
        return { path: path.join(buildRoot, OUTPUT_DIR), dir: OUTPUT_DIR }
    }

    for (const candidate of OUTPUT_CANDIDATES) {
        const candidatePath = path.join(buildRoot, candidate)
        if (fs.existsSync(candidatePath) && fs.statSync(candidatePath).isDirectory()) {
            return { path: candidatePath, dir: candidate }
        }
    }

    if (fs.existsSync(path.join(buildRoot, '.next'))) {
        return {
            error:
                'Found a Next.js server build (.next) but no static export. ' +
                'This platform serves static files only. Add `output: "export"` ' +
                'to next.config.js so the build produces an `out/` folder.',
        }
    }

    return {
        error:
            `No static output folder found (looked for: ${OUTPUT_CANDIDATES.join(', ')}). ` +
            'Set the OUTPUT_DIR environment variable to your build output folder.',
    }
}

let producer = null

async function initKafka() {
    if (!process.env.KAFKA_BROKER) return
    try {
        const kafkaCertPath = path.join(__dirname, 'kafka.pem')
        const kafka = new Kafka({
            clientId: `build-server-${DEPLOYMENT_ID}`,
            brokers: [process.env.KAFKA_BROKER],
            retry: { retries: 2 },
            ...(process.env.KAFKA_USERNAME
                ? {
                    sasl: {
                        username: process.env.KAFKA_USERNAME,
                        password: process.env.KAFKA_PASSWORD,
                        mechanism: 'plain',
                    },
                    ssl: fs.existsSync(kafkaCertPath)
                        ? { ca: [fs.readFileSync(kafkaCertPath, 'utf-8')] }
                        : true,
                }
                : {}),
        })
        producer = kafka.producer()
        await producer.connect()
    } catch (err) {
        console.warn('Kafka init failed, logs will not stream:', err.message)
        producer = null
    }
}

async function publishLog(log) {
    const line = log.toString().trim()
    if (!line) return
    console.log(line)
    if (!producer) return
    try {
        await producer.send({
            topic: 'container-logs',
            messages: [{
                value: JSON.stringify({ PROJECT_ID, DEPLOYMENT_ID, log: line })
            }]
        })
    } catch { }
}

function execAsync(command, cwd, extraEnv = {}) {
    return new Promise((resolve, reject) => {
        const p = exec(command, { cwd, env: { ...process.env, ...extraEnv } })
        p.stdout.on('data', async (data) => {
            for (const line of data.toString().split('\n')) {
                await publishLog(line)
            }
        })
        p.stderr.on('data', async (data) => {
            for (const line of data.toString().split('\n')) {
                await publishLog(`[stderr] ${line}`)
            }
        })
        p.on('close', (code) => {
            if (code !== 0) reject(new Error(`Command "${command}" exited with code ${code}`))
            else resolve()
        })
    })
}

async function init() {
    if (!GIT_REPOSITORY_URL) {
        console.error('GIT_REPOSITORY_URL is not set')
        process.exit(1)
    }

    await initKafka()

    const outDirPath = path.join(__dirname, 'output')
    if (fs.existsSync(outDirPath)) {
        fs.rmSync(outDirPath, { recursive: true, force: true })
    }
    fs.mkdirSync(outDirPath, { recursive: true })

    await publishLog(`Cloning ${GIT_REPOSITORY_URL}…`)
    await execAsync(`git clone --depth=1 ${GIT_REPOSITORY_URL} .`, outDirPath)
    await publishLog('Clone complete.')

    const buildRoot = ROOT_DIR ? path.join(outDirPath, ROOT_DIR) : outDirPath

    const projectEnv = {}
    try {
        for (const { key, value } of JSON.parse(process.env.PROJECT_ENV || '[]')) {
            if (key) projectEnv[key] = value ?? ''
        }
    } catch {
        await publishLog('[warn] Could not parse PROJECT_ENV; skipping project env vars')
    }

    const envKeys = Object.keys(projectEnv)
    if (envKeys.length) {
        const dotenv = envKeys
            .map((k) => `${k}=${String(projectEnv[k]).replace(/\n/g, '\\n')}`)
            .join('\n')
        fs.writeFileSync(path.join(buildRoot, '.env'), dotenv + '\n')
        await publishLog(`Injected ${envKeys.length} environment variable(s): ${envKeys.join(', ')}`)
    }

    await publishLog(`Installing dependencies: ${INSTALL_COMMAND}`)
    await execAsync(INSTALL_COMMAND, buildRoot, projectEnv)

    await publishLog(`Building: ${BUILD_COMMAND}`)
    await execAsync(BUILD_COMMAND, buildRoot, projectEnv)

    await publishLog('Build complete. Uploading assets…')

    const resolved = resolveOutputDir(buildRoot)

    if (resolved.error) {
        await publishLog(`ERROR: ${resolved.error}`)
        await producer?.disconnect()
        process.exit(1)
    }

    const distFolderPath = resolved.path
    await publishLog(`Using output folder: ${resolved.dir}`)

    const distFolderContents = fs.readdirSync(distFolderPath, { recursive: true })

    for (const file of distFolderContents) {
        const filePath = path.join(distFolderPath, file)
        if (fs.lstatSync(filePath).isDirectory()) continue

        await publishLog(`Uploading ${file}`)

        const command = new PutObjectCommand({
            Bucket: process.env.AWS_S3_BUCKET || 'vercel-clone-outputs',
            Key: `__outputs/${PROJECT_ID}/${file}`,
            Body: fs.createReadStream(filePath),
            ContentType: mime.lookup(filePath) || 'application/octet-stream',
        })

        await s3Client.send(command)
        await publishLog(`Uploaded ${file}`)
    }

    await publishLog('Deployment complete.')
    await producer?.disconnect()
}

init().catch(async (err) => {
    console.error('Fatal build error:', err.message)
    await publishLog(`ERROR: ${err.message}`)
    await producer?.disconnect()
    process.exit(1)
})
