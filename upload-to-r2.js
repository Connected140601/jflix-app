const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');
const fs = require('fs');
const path = require('path');

// R2 Configuration
const R2_ACCOUNT_ID = 'YOUR_R2_ACCOUNT_ID'; // Replace with your R2 account ID
const R2_ACCESS_KEY_ID = 'YOUR_R2_ACCESS_KEY_ID'; // Replace with your R2 access key
const R2_SECRET_ACCESS_KEY = 'YOUR_R2_SECRET_ACCESS_KEY'; // Replace with your R2 secret key
const R2_BUCKET = 'jflix-assets'; // Bucket name

const s3Client = new S3Client({
  region: 'auto',
  endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: R2_ACCESS_KEY_ID,
    secretAccessKey: R2_SECRET_ACCESS_KEY,
  },
});

const filesToUpload = [
  {
    localPath: path.join(__dirname, 'dist', 'JFlix-1.4.1-arm64.pkg'),
    remoteKey: 'electron/JFlix-1.4.1-arm64.pkg',
    contentType: 'application/x-newton-compatible-pkg'
  },
  {
    localPath: path.join(__dirname, 'dist', 'JFlix-1.4.1-x64.pkg'),
    remoteKey: 'electron/JFlix-1.4.1-x64.pkg',
    contentType: 'application/x-newton-compatible-pkg'
  },
  {
    localPath: path.join(__dirname, 'dist', 'JFlix-1.4.1-Portable.exe'),
    remoteKey: 'electron/JFlix-1.4.1-Portable.exe',
    contentType: 'application/vnd.microsoft.portable-executable'
  },
  {
    localPath: path.join(__dirname, 'dist', 'JFlix-Setup-1.4.1.exe'),
    remoteKey: 'electron/JFlix-Setup-1.4.1.exe',
    contentType: 'application/vnd.microsoft.portable-executable'
  }
];

async function uploadFile(file) {
  try {
    const fileStream = fs.createReadStream(file.localPath);
    const fileStats = fs.statSync(file.localPath);
    
    const command = new PutObjectCommand({
      Bucket: R2_BUCKET,
      Key: file.remoteKey,
      Body: fileStream,
      ContentType: file.contentType,
      ContentLength: fileStats.size,
    });

    await s3Client.send(command);
    console.log(`✓ Uploaded: ${file.remoteKey} (${(fileStats.size / 1024 / 1024).toFixed(2)} MB)`);
  } catch (error) {
    console.error(`✗ Failed to upload ${file.remoteKey}:`, error);
    throw error;
  }
}

async function uploadAll() {
  console.log('Starting upload to R2 bucket:', R2_BUCKET);
  console.log('Files to upload:', filesToUpload.length);
  console.log('');

  for (const file of filesToUpload) {
    if (fs.existsSync(file.localPath)) {
      await uploadFile(file);
    } else {
      console.error(`✗ File not found: ${file.localPath}`);
    }
  }

  console.log('');
  console.log('Upload complete!');
}

uploadAll().catch(console.error);
