/** What getObject hands back. Bytes plus the type they were stored under. */
export type StorageObject = {
	bytes: Uint8Array;
	contentType: string;
};

/**
 * The whole storage surface this app uses. Four functions, no provider types
 * in the signatures, and `key` is a plain slash-separated string — valid as an
 * object key in R2, S3, and Supabase Storage alike.
 *
 * That is the point: nothing above this line knows where bytes live, and the
 * URLs persisted in `notes.attachments` are our own /api/media paths rather
 * than provider URLs, so changing provider can never invalidate stored data.
 */
export type StoragePort = {
	putObject(key: string, bytes: Uint8Array, contentType: string): Promise<void>;
	getObject(key: string): Promise<StorageObject | null>;
	deleteObjects(keys: string[]): Promise<void>;
	listPrefix(prefix: string): Promise<string[]>;
};
