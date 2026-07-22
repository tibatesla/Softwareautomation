import { Storage } from '@google-cloud/storage';
import fs from 'fs';

const storage = new Storage();
const bucketName = process.env.GCP_BUCKET_NAME || 'chestone-creative-assets';

export class GCSService {
  public async streamToGCPAndGetUrl(localFilePath: string, propertyId: string): Promise<string> {
  const bucket = storage.bucket(bucketName);
  const destinationPath = `branded_renders/${propertyId}_${Date.now()}.mp4`;
  const gcsFile = bucket.file(destinationPath);

  return new Promise((resolve, reject) => {
    fs.createReadStream(localFilePath)
      .pipe(gcsFile.createWriteStream({ resumable: false, metadata: { contentType: 'video/mp4' } }))
      .on('error', reject)
      .on('finish', async () => {
        await gcsFile.makePublic();
        const publicUrl = `https://storage.googleapis.com/${bucketName}/${destinationPath}`;
        resolve(publicUrl);
      });
  });
}
}
export const gcsService = new GCSService();