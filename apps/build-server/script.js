const { exec } = require("child_process");
const path = require("path");
const fs = require("fs");
const fsPromises = fs.promises;
const { S3Client, PutObjectCommand } = require("@aws-sdk/client-s3");
const mime = require("mime-types");
const { Kafka } = require('kafkajs');
const { createAwsIamSaslSigner } = require('aws-msk-iam-sasl-signer-js');

const requiredEnvVars = [
    'AWS_REGION',
    'AWS_ACCESS_KEY_ID',
    'AWS_SECRET_ACCESS_KEY',
    'PROJECT_ID',
    'DEPLOYMENT_ID',
    'AWS_MKS_KAFKA',
    'S3_BUCKET_NAME'
];

for (const envVar of requiredEnvVars) {
    if (!process.env[envVar]) {
        console.error(`Missing required environment variable: ${envVar}`);
        process.exit(1);
    };
};

const PROJECT_ID = process.env.PROJECT_ID;
const S3_BUCKET_NAME = process.env.S3_BUCKET_NAME;
const DEPLOYMENT_ID = process.env.DEPLOYMENT_ID;

const s3Client = new S3Client({
    region: process.env.AWS_REGION,
    credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
    },
});

const kafka = new Kafka({
    clientId: `docker-build-server-${DEPLOYMENT_ID}`,
    brokers: [process.env.AWS_MKS_KAFKA],
    sasl: {
        mechanism: 'aws',
        authenticationProvider: createAwsIamSaslSigner({
            region: process.env.AWS_REGION
        }),
    },
    ssl: true
});

const producer = kafka.producer();


/**
 * Publish a log message to Kafka
 * @param {string} log - Log message to publish
 * @param {string} level - Log level (info, error, warn)
 */
async function publishLog(log, level = 'log') {
    try {
        await producer.send({
            topic: `container-logs`, messages: [
                {
                    key: level,
                    value: JSON.stringify({
                        PROJECT_ID,
                        DEPLOYMENT_ID,
                        log,
                        timestamp: new Date().toISOString(),
                        level,
                    }),
                },
            ]
        });
    } catch (error) {
        console.error('Failed to publish log:', error);
    }
};


/**
 * Validate if a path exists and is accessible
 * @param {string} pathToValidate - Path to validate
 * @returns {Promise<boolean>} - True if path exists and is accessible
 */
async function validatePath(pathToValidate) {
    try {
        await fsPromises.access(pathToValidate, fs.constants.F_OK);
        return true;
    } catch (error) {
        return false;
    };
};


/**
 * Upload a file to S3 preserving its directory structure
 * @param {string} basePath - Base path to calculate relative paths from
 * @param {string} filePath - Absolute path to the file
 * @returns {Promise<void>}
 */
async function uploadFileToS3(basePath, filePath) {
    try {

        const normalizedBasePath = path.normalize(basePath);
        const normalizedFilePath = path.normalize(filePath);

        const relativePath = path.relative(normalizedBasePath, normalizedFilePath);
        const s3Key = `__output/${PROJECT_ID}/${relativePath}`;

        console.log(`Uploading ${relativePath} to S3...`);
        await publishLog(`Uploading ${relativePath}`);

        const fileStats = await fsPromises.stat(filePath);

        const command = new PutObjectCommand({
            Bucket: S3_BUCKET_NAME,
            Key: s3Key,
            Body: fs.createReadStream(filePath),
            ContentType: mime.lookup(filePath) || 'application/octet-stream'
        });

        await s3Client.send(command);
        console.log(`Uploaded ${relativePath} (${fileStats.size} bytes)`);
        await publishLog(`Uploaded ${relativePath} (${fileStats.size} bytes)`);
    } catch (error) {
        console.error(`Error uploading ${filePath}:`, error);
        await publishLog(`Error uploading ${filePath}: ${error.message}`, 'error');
        throw error;
    }
};


/**
 * Recursively scan a directory and upload all files to S3
 * @param {string} basePath - Base path for relative path calculation
 * @param {string} dirPath - Directory to scan
 * @returns {Promise<void>}
 */
async function uploadDirectoryToS3(basePath, dirPath) {
    try {
        const items = await fsPromises.readdir(dirPath);
        const uploadPromises = [];
        for (const item of items) {
            const itemPath = path.join(dirPath, item);
            const stats = await fsPromises.stat(itemPath);

            if (stats.isDirectory()) {
                uploadPromises.push(uploadDirectoryToS3(basePath, itemPath));
            } else if (stats.isFile()) {
                uploadPromises.push(uploadFileToS3(basePath, itemPath));
            };
        };
        await Promise.all(uploadPromises);
    } catch (error) {
        console.error(`Error processing directory ${dirPath}:`, error);
        await publishLog(`Error processing directory ${dirPath}: ${error.message}`, 'error');
        throw error;
    };
};


/**
 * Execute a build process
 * @param {string} workingDir - Directory to run the build in
 * @returns {Promise<void>}
 */
async function runBuild(workingDir) {
    if (!(await validatePath(workingDir))) {
        throw new Error(`Build directory not found: ${workingDir}`);
    };

    return new Promise((resolve, reject) => {
        const buildProcess = exec(`cd ${workingDir} && npm install && npm run build`);

        buildProcess.stdout.on('data', async (data) => {
            const message = data.toString().trim();
            if (message) {
                console.log(message);
                await publishLog(message);
            }
        });

        buildProcess.stderr.on('data', async (data) => {
            const message = data.toString().trim();
            if (message) {
                console.error(message);
                await publishLog(message, 'error');
            }
        });

        buildProcess.on('close', (code) => {
            if (code === 0) {
                resolve();
            } else {
                reject(new Error(`Build process exited with code ${code}`));
            }
        });

        buildProcess.on('error', (error) => {
            reject(error);
        });

        runBuild.currentProcess = buildProcess;
    });
};


// Store active processes for cleanup
runBuild.currentProcess = null;


/**
 * Gracefully shutdown all resources
 * @returns {Promise<void>}
 */
async function shutdown() {
    console.log('Shutting down resources...');
    if (runBuild.currentProcess) {
        console.log('Terminating active build process...');
        runBuild.currentProcess.kill();
        runBuild.currentProcess = null;
    };

    try {

        if (producer && producer.isConnected) {
            await producer.disconnect();
            console.log('Kafka producer disconnected.');
        }
    } catch (error) {
        console.error('Error during shutdown:', error);
    };
};


/**
 * Main execution function
 * @returns {Promise<void>}
 */
async function init() {
    let buildProcess = null;
    try {
        console.log(`Starting deployment in Docker container for Project: ${PROJECT_ID}, Deployment: ${DEPLOYMENT_ID}`);
        await producer.connect();
        console.log("Kafka producer connected");

        console.log("Starting build process");
        await publishLog("Build Started...");

        const outdirPath = path.join(__dirname, 'output');
        if (!(await validatePath(outdirPath))) {
            throw new Error(`Output directory not found: ${outdirPath}`);
        };

        await runBuild(outdirPath);

        console.log("Build complete");
        await publishLog("Build complete");

        const distFolderPath = path.join(__dirname, 'output', 'dist');
        if (!(await validatePath(distFolderPath))) {
            throw new Error(`Build output directory not found: ${distFolderPath}`);
        };

        await uploadDirectoryToS3(distFolderPath, distFolderPath);

        console.log("Deployment complete");
        await publishLog("Deployment complete");

    } catch (error) {
        console.error("Fatal error:", error);
        await publishLog(`Fatal error: ${error.message}`, 'error');
        process.exitCode = 1;
    } finally {
        await shutdown();
    };
};

// Set up signal handlers for graceful shutdown
['SIGINT', 'SIGTERM'].forEach(signal => {
    process.on(signal, async () => {
        console.log(`Received ${signal}, shutting down...`);
        await shutdown();
        process.exit(0);
    });
});

// Handle uncaught exceptions
process.on('uncaughtException', async (error) => {
    console.error('Uncaught exception:', error);
    await publishLog(`Uncaught exception: ${error.message}`, 'error');
    await shutdown();
    process.exit(1);
});


// Handle unhandled promise rejections
process.on('unhandledRejection', async (reason) => {
    console.error('Unhandled promise rejection:', reason);
    await publishLog(`Unhandled promise rejection: ${reason}`, 'error');
    await shutdown();
    process.exit(1);
});

// Start the process
init().catch(async (error) => {
    console.error("Unhandled error in init():", error);
    await publishLog(`Unhandled error: ${error.message}`, 'error');
    await shutdown();
    process.exit(1);
});