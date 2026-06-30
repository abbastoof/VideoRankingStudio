import { S3Client } from '@aws-sdk/client-s3';

import { env } from './env';

let _s3: S3Client | undefined;

export function getS3(): S3Client {
  if (_s3) return _s3;
  _s3 = new S3Client({
    region: env.S3_REGION,
    endpoint: env.S3_ENDPOINT,
    forcePathStyle: env.S3_FORCE_PATH_STYLE,
    credentials: {
      accessKeyId: env.S3_ACCESS_KEY_ID,
      secretAccessKey: env.S3_SECRET_ACCESS_KEY,
    },
  });
  return _s3;
}

export const buckets = {
  uploads: env.S3_BUCKET_UPLOADS,
  generated: env.S3_BUCKET_GENERATED,
  exports: env.S3_BUCKET_EXPORTS,
  public: env.S3_BUCKET_PUBLIC,
} as const;
