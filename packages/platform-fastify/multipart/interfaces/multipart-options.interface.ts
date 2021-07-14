import { FastifyMultipartFile } from './multipart-file.interface';

export interface MultipartOptions {
  /** Destination folder, if not undefined uploaded file will be saved locally in dest path */
  dest?: string;
  /**
   * An object specifying the size limits of the following optional properties. This object is passed to busboy
   * directly, and the details of properties can be found on https://github.com/mscdex/busboy#busboy-methods
   */
  limits?: {
    /** Max field name size (in bytes) (Default: 100 bytes) */
    fieldnameSize?: number;
    /** Max field value size (in bytes) (Default: 1MB) */
    fieldSize?: number;
    /** Max number of non-file fields (Default: Infinity) */
    fields?: number;
    /** For multipart forms, the max file size (in bytes) (Default: Infinity) */
    fileSize?: number;
    /** For multipart forms, the max number of file fields (Default: Infinity) */
    files?: number;
    /** For multipart forms, the max number of parts (fields + files) (Default: Infinity) */
    parts?: number;
    /** For multipart forms, the max number of header key=>value pairs to parse Default: 2000 (same as node's http) */
    headerPairs?: number;
  };
  /** These are the HTTP headers of the incoming request, which are used by individual parsers */
  headers?: any;
  /** highWaterMark to use for this Busboy instance (Default: WritableStream default). */
  highWaterMark?: number;
  /** highWaterMark to use for file streams (Default: ReadableStream default) */
  fileHwm?: number;
  /** Default character set to use when one isn't defined (Default: 'utf8') */
  defCharset?: string;
  /** If paths in the multipart 'filename' field shall be preserved. (Default: false) */
  preservePath?: boolean;
  /** Function to control which files are accepted */
  fileFilter?(
    req: any,
    file: FastifyMultipartFile,
    callback: (error: Error | null, acceptFile?: boolean) => void,
  ): void;
}

export interface UploadField {
  /** The field name. */
  name: string;
  /** Optional maximum number of files per field to accept. */
  maxCount?: number;
}
