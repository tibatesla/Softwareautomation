// test-vision.ts — standalone Gemini vision smoke test. Free tier, zero cost.
// Usage: npx ts-node test-vision.ts
import 'dotenv/config';
import { analyzePhoto } from './src/services/photo-vision.service';

const TEST_PHOTO_URL = 'https://assets.cdn.filesafe.space/gZq4AjxCqZKGYlYZXFjB/media/6a536afe708c41d4df1e437e.jpeg';
analyzePhoto(TEST_PHOTO_URL)
  .then((result) => {
    console.log('--- VISION SUCCESS ---');
    console.log(JSON.stringify(result, null, 2));
  })
  .catch((err) => {
    console.error('--- VISION FAILED ---');
    console.error(err.message);
    process.exit(1);
  });