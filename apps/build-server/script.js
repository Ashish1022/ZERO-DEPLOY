const fs = require('fs')
const path = require('path')
const mime = require('mime-types')
const { exec } = require('child_process')
const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3')
const { Kafka } = require('kafkajs')

const s3Client = new S3Client({
    region: process.env.AWS_REGION || 'ap-south-1',
    credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    }
})

const PROJECT_ID = process.env.PROJECT_ID
const DEPLOYMENT_ID = process.env.DEPLOYMENT_ID
const GIT_REPOSITORY_URL = process.env.GIT_REPOSITORY_URL
const INSTALL_COMMAND = process.env.INSTALL_COMMAND || 'npm install'
const BUILD_COMMAND = process.env.BUILD_COMMAND || 'npm run build'
const OUTPUT_DIR = process.env.OUTPUT_DIR || 'dist'
const ROOT_DIR = (process.env.ROOT_DIR || '/').replace(/^\//, '')

let producer = null

async function initKafka() {
    if (!process.env.KAFKA_BROKER) return
    try {
        const kafkaCertPath = path.join(__dirname, 'kafka.pem')
        const kafka = new Kafka({
            clientId: `build-server-${DEPLOYMENT_ID}`,
            brokers: [process.env.KAFKA_BROKER],
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
    } catch {
        // Non-fatal
    }
}

function execAsync(command, cwd) {
    return new Promise((resolve, reject) => {
        const p = exec(command, { cwd })
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

    // Navigate into root dir if specified
    const buildRoot = ROOT_DIR ? path.join(outDirPath, ROOT_DIR) : outDirPath

    await publishLog(`Installing dependencies: ${INSTALL_COMMAND}`)
    await execAsync(INSTALL_COMMAND, buildRoot)

    await publishLog(`Building: ${BUILD_COMMAND}`)
    await execAsync(BUILD_COMMAND, buildRoot)

    await publishLog('Build complete. Uploading assets…')

    const distFolderPath = path.join(buildRoot, OUTPUT_DIR)

    if (!fs.existsSync(distFolderPath)) {
        await publishLog(`ERROR: Output folder not found at ${distFolderPath}`)
        await producer?.disconnect()
        process.exit(1)
    }

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
