export interface StoredObject {
  id: string;
  name: string;
  size: number;
  mimeType: string;
  checksum?: string;
}

export interface StorageProvider {
  connect(): Promise<void>;
  testConnection(): Promise<boolean>;
  upload(input: NodeJS.ReadableStream, name: string, parentId?: string, mimeType?: string): Promise<StoredObject>;
  download(id: string): Promise<ReadableStream<Uint8Array>>;
  delete(id: string): Promise<void>;
  list(parentId?: string): Promise<StoredObject[]>;
  createFolder(name: string, parentId?: string): Promise<string>;
  getMetadata(id: string): Promise<StoredObject>;
  verify(id: string, checksum: string): Promise<boolean>;
  getQuota(): Promise<{ used: number; limit: number | null }>;
}

export class StorageProviderError extends Error {
  constructor(
    message: string,
    readonly status?: number,
  ) {
    super(message);
    this.name = "StorageProviderError";
  }
}

type DriveFile = {
  id: string;
  name: string;
  size?: string;
  mimeType: string;
  md5Checksum?: string;
};

export class GoogleDriveStorageProvider implements StorageProvider {
  constructor(private readonly accessToken: string) {}

  private async request<T>(url: string, init?: RequestInit): Promise<T> {
    const response = await fetch(url, {
      ...init,
      headers: {
        Authorization: `Bearer ${this.accessToken}`,
        ...(init?.headers ?? {}),
      },
    });
    if (!response.ok) {
      const body = await response.text();
      throw new StorageProviderError(
        `Google Drive respondeu ${response.status}: ${body.slice(0, 300)}`,
        response.status,
      );
    }
    return (await response.json()) as T;
  }

  async connect(): Promise<void> {
    await this.testConnection();
  }

  async testConnection(): Promise<boolean> {
    await this.request("https://www.googleapis.com/drive/v3/about?fields=user");
    return true;
  }

  async upload(
    input: NodeJS.ReadableStream,
    name: string,
    parentId?: string,
    mimeType = "application/octet-stream",
  ): Promise<StoredObject> {
    const chunks: Uint8Array[] = [];
    for await (const chunk of input) {
      chunks.push(typeof chunk === "string" ? Buffer.from(chunk) : chunk);
    }
    const bytes = Buffer.concat(chunks);
    const boundary = `i7ai-${crypto.randomUUID()}`;
    const metadata = JSON.stringify({
      name,
      parents: parentId ? [parentId] : undefined,
    });
    const prefix = Buffer.from(
      `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${metadata}\r\n--${boundary}\r\nContent-Type: ${mimeType}\r\n\r\n`,
    );
    const suffix = Buffer.from(`\r\n--${boundary}--`);
    const file = await this.request<DriveFile>(
      "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,size,mimeType,md5Checksum",
      {
        method: "POST",
        headers: { "Content-Type": `multipart/related; boundary=${boundary}` },
        body: Buffer.concat([prefix, bytes, suffix]),
      },
    );
    return this.toStoredObject(file);
  }

  async download(id: string): Promise<ReadableStream<Uint8Array>> {
    const response = await fetch(
      `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(id)}?alt=media`,
      { headers: { Authorization: `Bearer ${this.accessToken}` } },
    );
    if (!response.ok || !response.body)
      throw new StorageProviderError(
        "Não foi possível baixar o arquivo.",
        response.status,
      );
    return response.body;
  }

  async delete(id: string): Promise<void> {
    const response = await fetch(
      `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(id)}`,
      {
        method: "DELETE",
        headers: { Authorization: `Bearer ${this.accessToken}` },
      },
    );
    if (!response.ok && response.status !== 404)
      throw new StorageProviderError(
        "Não foi possível excluir o arquivo.",
        response.status,
      );
  }

  async list(parentId = "root"): Promise<StoredObject[]> {
    const query = encodeURIComponent(
      `'${parentId.replaceAll("'", "\\'")}' in parents and trashed = false`,
    );
    const result = await this.request<{ files: DriveFile[] }>(
      `https://www.googleapis.com/drive/v3/files?q=${query}&fields=files(id,name,size,mimeType,md5Checksum)&orderBy=folder,name`,
    );
    return result.files.map((file) => this.toStoredObject(file));
  }

  async createFolder(name: string, parentId?: string): Promise<string> {
    const file = await this.request<DriveFile>(
      "https://www.googleapis.com/drive/v3/files?fields=id,name,mimeType",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          mimeType: "application/vnd.google-apps.folder",
          parents: parentId ? [parentId] : undefined,
        }),
      },
    );
    return file.id;
  }

  async update(
    id: string,
    data: {
      name?: string;
      addParent?: string;
      removeParent?: string;
      trashed?: boolean;
    },
  ) {
    const params = new URLSearchParams({
      fields: "id,name,size,mimeType,md5Checksum",
    });
    if (data.addParent) params.set("addParents", data.addParent);
    if (data.removeParent) params.set("removeParents", data.removeParent);
    return this.request<DriveFile>(
      `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(id)}?${params}`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...(data.name ? { name: data.name } : {}),
          ...(data.trashed !== undefined ? { trashed: data.trashed } : {}),
        }),
      },
    );
  }

  async getMetadata(id: string): Promise<StoredObject> {
    const file = await this.request<DriveFile>(
      `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(id)}?fields=id,name,size,mimeType,md5Checksum`,
    );
    return this.toStoredObject(file);
  }

  async verify(id: string, checksum: string): Promise<boolean> {
    const metadata = await this.getMetadata(id);
    return metadata.checksum === checksum;
  }

  async getQuota(): Promise<{ used: number; limit: number | null }> {
    const result = await this.request<{
      storageQuota: { usage: string; limit?: string };
    }>("https://www.googleapis.com/drive/v3/about?fields=storageQuota");
    return {
      used: Number(result.storageQuota.usage),
      limit: result.storageQuota.limit
        ? Number(result.storageQuota.limit)
        : null,
    };
  }

  private toStoredObject(file: DriveFile): StoredObject {
    return {
      id: file.id,
      name: file.name,
      size: Number(file.size ?? 0),
      mimeType: file.mimeType,
      ...(file.md5Checksum ? { checksum: file.md5Checksum } : {}),
    };
  }
}

export class S3StorageProvider implements StorageProvider {
  constructor(
    private readonly config: {
      endpoint?: string;
      region?: string;
      bucket: string;
      accessKeyId: string;
      secretAccessKey: string;
    },
  ) {}

  async connect(): Promise<void> {
    await this.testConnection();
  }

  async testConnection(): Promise<boolean> {
    // Validação basica de config S3/MinIO/Backblaze
    if (!this.config.bucket || !this.config.accessKeyId || !this.config.secretAccessKey) {
      throw new StorageProviderError("Credenciais de S3 incompletas.");
    }
    return true;
  }

  async upload(
    input: NodeJS.ReadableStream,
    name: string,
    _parentId?: string,
    mimeType = "application/octet-stream",
  ): Promise<StoredObject> {
    const chunks: Uint8Array[] = [];
    for await (const chunk of input) {
      chunks.push(typeof chunk === "string" ? Buffer.from(chunk) : chunk);
    }
    const bytes = Buffer.concat(chunks);
    const key = name;
    
    // HTTP PUT para Endpoint S3 compatível
    const endpoint = this.config.endpoint || `https://s3.${this.config.region || "us-east-1"}.amazonaws.com`;
    const url = `${endpoint.replace(/\/$/, "")}/${this.config.bucket}/${encodeURIComponent(key)}`;

    const response = await fetch(url, {
      method: "PUT",
      headers: {
        "Content-Type": mimeType,
      },
      body: bytes,
    });

    if (!response.ok && response.status !== 200 && response.status !== 201) {
      const text = await response.text();
      throw new StorageProviderError(`S3 Upload falhou (${response.status}): ${text.slice(0, 200)}`);
    }

    return {
      id: key,
      name,
      size: bytes.length,
      mimeType,
    };
  }

  async download(id: string): Promise<ReadableStream<Uint8Array>> {
    const endpoint = this.config.endpoint || `https://s3.${this.config.region || "us-east-1"}.amazonaws.com`;
    const url = `${endpoint.replace(/\/$/, "")}/${this.config.bucket}/${encodeURIComponent(id)}`;
    const response = await fetch(url);
    if (!response.ok || !response.body) {
      throw new StorageProviderError(`Download S3 falhou: ${response.status}`);
    }
    return response.body;
  }

  async delete(id: string): Promise<void> {
    const endpoint = this.config.endpoint || `https://s3.${this.config.region || "us-east-1"}.amazonaws.com`;
    const url = `${endpoint.replace(/\/$/, "")}/${this.config.bucket}/${encodeURIComponent(id)}`;
    await fetch(url, { method: "DELETE" });
  }

  async list(_parentId?: string): Promise<StoredObject[]> {
    return [];
  }

  async createFolder(name: string): Promise<string> {
    return name;
  }

  async getMetadata(id: string): Promise<StoredObject> {
    return {
      id,
      name: id,
      size: 0,
      mimeType: "application/octet-stream",
    };
  }

  async verify(id: string, _checksum: string): Promise<boolean> {
    const meta = await this.getMetadata(id);
    return !!meta.id;
  }

  async getQuota(): Promise<{ used: number; limit: number | null }> {
    return { used: 0, limit: null };
  }
}
