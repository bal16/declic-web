import { Injectable, Optional } from '@nestjs/common';
import { S3Client } from 'bun';

import { requiredEnv } from '../common/config';

export interface StoredObject {
  s3Key: string;
  url: string;
  sizeBytes: number;
}

export function buildDerivativeKey(photoItemId: string, file: string): string {
  return `derivatives/${photoItemId}/${file}`;
}

export function buildPublicUrl(
  endpoint: string,
  bucket: string,
  s3Key: string,
): string {
  return `${endpoint.replace(/\/+$/, '')}/${bucket}/${s3Key}`;
}

@Injectable()
export class ObjectStorageService {
  private readonly client: S3Client;
  private readonly endpoint: string;
  private readonly bucket: string;

  // Client injectable for tests; production default builds from env.
  // @Optional: no S3Client provider is registered on purpose.
  constructor(@Optional() client?: S3Client) {
    this.endpoint = requiredEnv('S3_ENDPOINT');
    this.bucket = requiredEnv('S3_BUCKET');
    this.client =
      client ??
      new S3Client({
        accessKeyId: requiredEnv('S3_ACCESS_KEY'),
        secretAccessKey: requiredEnv('S3_SECRET_KEY'),
        bucket: this.bucket,
        endpoint: this.endpoint,
        // Bun defaults to path-style; only AWS-style deployments opt out.
        virtualHostedStyle: requiredEnv('S3_FORCE_PATH_STYLE') === 'false',
      });
  }

  async getObject(s3Key: string): Promise<Buffer> {
    const file = this.client.file(s3Key);
    if (!(await file.exists())) {
      throw new Error(`Object not found in storage: ${s3Key}`);
    }
    return Buffer.from(await file.arrayBuffer());
  }

  async putObject(
    s3Key: string,
    data: Uint8Array,
    contentType: string,
  ): Promise<StoredObject> {
    await this.client.write(s3Key, data, { type: contentType });
    return {
      s3Key,
      url: buildPublicUrl(this.endpoint, this.bucket, s3Key),
      sizeBytes: data.byteLength,
    };
  }
}
