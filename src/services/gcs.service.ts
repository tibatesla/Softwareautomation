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
          const [signedUrl] = await gcsFile.getSignedUrl({
            version: 'v4', action: 'read', expires: Date.now() + 90 * 24 * 60 * 60 * 1000,
          });
          resolve(signedUrl);
        });
    });
  }
}
export const gcsService = new GCSService();