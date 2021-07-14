import * as sinon from 'sinon';
import * as fs from 'fs';
import * as path from 'path';
import { expect } from 'chai';
import { Readable, PassThrough } from 'stream';
import { HttpException, HttpStatus } from '@nestjs/common';
import { MultipartOptions } from '../../../multipart/interfaces/multipart-options.interface';
import { MultipartWrapper } from '../../../multipart/multipart/multipart-wrapper';
import { InterceptorFile } from '../../../multipart/interfaces/multipart-file.interface';
import { multipartExceptions } from '../../../multipart/multipart/multipart.constants';

describe('MultipartWrapper', () => {
  let fileObject: any = {};
  let filesArray: any[] = [];
  let req: any = {};
  const objectFieldname = 'single-file-fieldname';
  const arrayFieldname = 'array-files-fieldname';
  const mockReadable = new Readable({
    read(size) {
      this.push(null);
    },
  });
  async function* getMultipartIterator() {
    for await (const multipartFile of filesArray) {
      yield multipartFile;
    }
  }

  beforeEach(() => {
    (fs as any).promises.mkdir = (path: string, options: any) => {};
    (fs as any).createWriteStream = (path: string) => new PassThrough();
    (fs as any).existsSync = (path: string) => false;
    filesArray = [
      {
        fieldname: arrayFieldname,
        filename: 'original-file-test-1.png',
        encoding: '7bit',
        mimetype: 'image/png',
        file: mockReadable,
        fields: {},
      },
      {
        fieldname: arrayFieldname,
        filename: 'original-file-test-2.png',
        encoding: '7bit',
        mimetype: 'image/png',
        file: mockReadable,
        fields: {},
      },
    ];
    fileObject = {
      fieldname: objectFieldname,
      filename: 'original-file-test-3.png',
      encoding: '7bit',
      mimetype: 'image/png',
      file: mockReadable,
      fields: {},
    };
    fileObject.fields[objectFieldname] = [fileObject];
    fileObject.fields[arrayFieldname] = filesArray;
    for (const file of filesArray) {
      file.fields[arrayFieldname] = filesArray;
    }
    req = {
      file: async (options: MultipartOptions) => fileObject,
      files: async (options: MultipartOptions) => getMultipartIterator(),
    };
  });
  describe('writeFile', () => {
    it('should call fs.createWriteStream() with expected params', async () => {
      const options: MultipartOptions = {
        dest: 'upload/test',
      };
      const multipart = new MultipartWrapper(options);
      const createWriteStreamStub = sinon.spy(fs, 'createWriteStream');
      const file = await (multipart as any).writeFile(fileObject);
      expect(createWriteStreamStub.called).to.be.true;
      const filePath = path.join(options.dest, file.filename);
      expect(createWriteStreamStub.calledWith(filePath)).to.be.true;
    });
    it('should generate random filename and keep its originalname', async () => {
      const options: MultipartOptions = {
        dest: 'upload/test',
      };
      const multipart = new MultipartWrapper(options);
      const file = await (multipart as any).writeFile(fileObject);
      expect(file.originalname).to.equal(fileObject.filename);
      expect(file.filename).to.not.equal(fileObject.filename);
    });
    it('should add destination and path', async () => {
      const options: MultipartOptions = {
        dest: 'upload/test',
      };
      const multipart = new MultipartWrapper(options);
      const file = await (multipart as any).writeFile(fileObject);
      const filePath = path.join(options.dest, file.filename);
      expect(file.path).to.equal(filePath);
      expect(file.destination).to.equal(options.dest);
    });
    it('should add bytesWritten number to file.size', async () => {
      const options: MultipartOptions = {
        dest: 'upload/test',
      };
      const multipart = new MultipartWrapper(options);
      const bytesWritten = 1234;
      (fs as any).createWriteStream = (path: string) => {
        const writeStream = new PassThrough();
        (writeStream as any).bytesWritten = bytesWritten;
        return writeStream;
      };
      const file = await (multipart as any).writeFile(fileObject);
      expect(file.size).to.be.equal(bytesWritten);
    });
    describe('on error', () => {
      it('should call multipartFile.file.destroy()', async () => {
        (fs as any).createWriteStream = (path: string) => {
          const writeStream = new PassThrough();
          writeStream.on('data', () => {
            writeStream.emit('end');
          });
          writeStream.on('end', () => {
            writeStream.emit('error');
          });
          return writeStream;
        };
        const options: MultipartOptions = {
          dest: 'upload/test',
        };
        const multipart = new MultipartWrapper(options);
        fileObject.file.destroy = () => {};
        const destroyStub = sinon.stub(fileObject.file, 'destroy');
        try {
          await (multipart as any).writeFile(fileObject);
        } catch (error) {}
        expect(destroyStub.called).to.be.true;
      });
    });
  });
  describe('endStream', () => {
    it('should emit file end', async () => {
      const multipart = new MultipartWrapper({});
      const fileEmitStub = sinon.stub(fileObject.file, 'emit');
      await (multipart as any).endStream(fileObject);
      expect(fileEmitStub.called).to.be.true;
      expect(fileEmitStub.calledWith('end')).to.be.true;
    });
    it('should return file with originalname and size', async () => {
      const multipart = new MultipartWrapper({});
      const file = await (multipart as any).endStream(fileObject);
      expect(file.originalname).to.equal(fileObject.filename);
      expect(file.size).to.be.equal(fileObject.file.readableLength);
    });
  });
  describe('file', () => {
    it('should call file() with expected params', async () => {
      const multipart = new MultipartWrapper({});
      const fileSpy = sinon.spy(multipart, 'file');
      await multipart.file(objectFieldname)(req);
      expect(fileSpy.called).to.be.true;
      expect(fileSpy.calledWith(objectFieldname)).to.be.true;
    });
    it('should call req.file() with expected params', async () => {
      const options: MultipartOptions = {
        limits: {
          fieldSize: 10,
        },
      };
      const reqSpy = sinon.spy(req, 'file');
      const multipart = new MultipartWrapper(options);
      await multipart.file(objectFieldname)(req);
      expect(reqSpy.called).to.be.true;
      expect(reqSpy.calledWith(options)).to.be.true;
    });
    it('should not call writeFile() if dest is undefined', async () => {
      const multipart = new MultipartWrapper({});
      const writeFileSpy = sinon.spy(multipart, <any>'writeFile');
      await multipart.file(objectFieldname)(req);
      expect(writeFileSpy.called).to.be.false;
    });
    describe('options', () => {
      describe('dest', () => {
        it('should call mkdir with expected params', async () => {
          const options: MultipartOptions = {
            dest: 'upload/test',
          };
          const multipart = new MultipartWrapper(options);
          const fsSpy = sinon.spy(fs.promises, 'mkdir');
          await multipart.file(objectFieldname)(req);
          expect(fsSpy.called).to.be.true;
          expect(fsSpy.calledWith(options.dest, { recursive: true })).to.be
            .true;
        });
        it('should call writeFile() with expected params if dest is defined', async () => {
          const options: MultipartOptions = {
            dest: 'upload/test',
          };
          const multipart = new MultipartWrapper(options);
          const writeFileSpy = sinon.spy(multipart, <any>'writeFile');
          await multipart.file(objectFieldname)(req);
          expect(writeFileSpy.called).to.be.true;
          expect(writeFileSpy.calledWith(fileObject.fields[objectFieldname][0]))
            .to.be.true;
        });
      });
      describe('fileFilter', () => {
        it('should return undefined if options.fileFilter callback is (null, false)', async () => {
          const options: MultipartOptions = {
            fileFilter: (req, file, cb) => cb(null, false),
          };
          const multipart = new MultipartWrapper(options);
          const file = await multipart.file(objectFieldname)(req);
          expect(file).to.be.undefined;
        });
        it('should throw error if options.fileFilter callback is (Error, Boolean)', async () => {
          const errorMessage = 'Expect fileFilter test to throw error';
          const errorStatus = HttpStatus.I_AM_A_TEAPOT;
          const newHttpError = new HttpException(errorMessage, errorStatus);
          const options: MultipartOptions = {
            fileFilter: (req, file, cb) => cb(newHttpError, false),
          };
          const multipart = new MultipartWrapper(options);
          return expect(
            multipart.file(objectFieldname)(req),
          ).to.be.rejected.and.to.eventually.equal(newHttpError);
        });
      });
    });
  });
  describe('files', () => {
    it('should call files() with expected params', async () => {
      const multipart = new MultipartWrapper({});
      const maxCount = 10;
      const filesSpy = sinon.spy(multipart, 'files');
      await multipart.files(arrayFieldname, maxCount)(req);
      expect(filesSpy.called).to.be.true;
      expect(filesSpy.calledWith(arrayFieldname, maxCount)).to.be.true;
    });
    it('should call req.files() with expected options', async () => {
      const options: MultipartOptions = {
        limits: {},
      };
      const multipart = new MultipartWrapper(options);
      const maxCount = 10;
      const reqSpy = sinon.spy(req, 'files');
      await multipart.files(arrayFieldname, maxCount)(req);
      expect(reqSpy.called).to.be.true;
      expect(
        reqSpy.calledWith({
          ...options,
          limits: {
            ...options?.limits,
            files: maxCount,
          },
        }),
      ).to.be.true;
    });
    it('should not call writeFile() if dest is undefined', async () => {
      const multipart = new MultipartWrapper({
        dest: undefined,
      });
      const writeFileSpy = sinon.spy(multipart, <any>'writeFile');
      await multipart.any()(req);
      expect(writeFileSpy.called).to.be.false;
    });
    it("should call multipartFile.file.emit('end') if dest is undefined", async () => {
      (fs as any).existsSync = (path: string) => true;
      fileObject.file = new Readable();
      const emitEndStub = sinon.stub(fileObject.file, 'emit');
      filesArray = [fileObject];
      const multipart = new MultipartWrapper({});
      await multipart.files(arrayFieldname)(req);
      expect(emitEndStub.called).to.be.true;
    });
    describe('options', () => {
      describe('dest', () => {
        it('should call mkdir with expected params', async () => {
          const options: MultipartOptions = {
            dest: 'upload/test',
          };
          const multipart = new MultipartWrapper(options);
          const fsSpy = sinon.spy(fs.promises, 'mkdir');
          await multipart.files(arrayFieldname)(req);
          expect(fsSpy.called).to.be.true;
          expect(fsSpy.calledWith(options.dest, { recursive: true })).to.be
            .true;
        });
      });
      describe('fileFilter', () => {
        it('should return undefined if options.fileFilter callback is (null, false)', async () => {
          const options: MultipartOptions = {
            fileFilter: (req, file, cb) => cb(null, false),
          };
          const multipart = new MultipartWrapper(options);
          const files = await multipart.files(arrayFieldname)(req);
          expect(files).to.be.undefined;
        });
        it('should filter specific file if callback is (null, false)', async () => {
          const fileToFilter: InterceptorFile = filesArray[1];
          const options: MultipartOptions = {
            fileFilter: (req, file, cb) => {
              if (file.filename === fileToFilter.filename) {
                return cb(null, false);
              }
              cb(null, true);
            },
          };
          const multipart = new MultipartWrapper(options);
          const files = await multipart.files(arrayFieldname)(req);
          expect(files).to.not.have.members([fileToFilter]);
        });
        it('should throw error if options.fileFilter callback is (Error, Boolean)', async () => {
          const errorMessage = 'Expect fileFilter test to throw error';
          const errorStatus = HttpStatus.I_AM_A_TEAPOT;
          const newHttpError = new HttpException(errorMessage, errorStatus);
          const options: MultipartOptions = {
            fileFilter: (req, file, cb) => cb(newHttpError, false),
          };
          const multipart = new MultipartWrapper(options);
          return expect(
            multipart.files(arrayFieldname)(req),
          ).to.be.rejected.and.to.eventually.equal(newHttpError);
        });
      });
    });
  });
  describe('any', () => {
    it('should call req.files() with expected options', async () => {
      const options: MultipartOptions = {
        limits: {},
      };
      const multipart = new MultipartWrapper(options);
      const reqSpy = sinon.spy(req, 'files');
      await multipart.any()(req);
      expect(reqSpy.called).to.be.true;
      expect(reqSpy.calledWith(options)).to.be.true;
    });
    it('should not call writeFile() if dest is undefined', async () => {
      const multipart = new MultipartWrapper({
        dest: undefined,
      });
      const writeFileSpy = sinon.spy(multipart, <any>'writeFile');
      await multipart.any()(req);
      expect(writeFileSpy.called).to.be.false;
    });
    it("should call multipartFile.file.emit('end') if dest is undefined", async () => {
      (fs as any).existsSync = (path: string) => true;
      fileObject.file = new Readable();
      const emitEndStub = sinon.stub(fileObject.file, 'emit');
      filesArray = [fileObject];
      const multipart = new MultipartWrapper({});
      await multipart.any()(req);
      expect(emitEndStub.called).to.be.true;
    });
    describe('options', () => {
      describe('dest', () => {
        it('should call mkdir with expected params', async () => {
          const options: MultipartOptions = {
            dest: 'upload/test',
          };
          const multipart = new MultipartWrapper(options);
          const fsSpy = sinon.spy(fs.promises, 'mkdir');
          await multipart.any()(req);
          expect(fsSpy.called).to.be.true;
          expect(fsSpy.calledWith(options.dest, { recursive: true })).to.be
            .true;
        });
        it('should call writeFile() with expected params', async () => {
          const options: MultipartOptions = {
            dest: 'upload/test',
          };
          const multipart = new MultipartWrapper(options);
          const writeFileSpy = sinon.spy(multipart, <any>'writeFile');
          await multipart.any()(req);
          expect(writeFileSpy.called).to.be.true;
          expect(writeFileSpy.getCall(0).calledWith(filesArray[0])).to.be.true;
          expect(writeFileSpy.getCall(1).calledWith(filesArray[1])).to.be.true;
        });
      });
      describe('fileFilter', () => {
        it('should return undefined if options.fileFilter callback is (null, false)', async () => {
          const options: MultipartOptions = {
            fileFilter: (req, file, cb) => cb(null, false),
          };
          const multipart = new MultipartWrapper(options);
          const files = await multipart.any()(req);
          expect(files).to.be.undefined;
        });
        it('should filter specific file if callback is (null, false)', async () => {
          const fileToFilter: InterceptorFile = filesArray[1];
          const options: MultipartOptions = {
            fileFilter: (req, file, cb) => {
              if (file.filename === fileToFilter.filename) {
                return cb(null, false);
              }
              cb(null, true);
            },
          };
          const multipart = new MultipartWrapper(options);
          const files = await multipart.any()(req);
          expect(files).to.not.have.members([fileToFilter]);
        });
        it('should throw error if options.fileFilter callback is (Error, Boolean)', async () => {
          const errorMessage = 'Expect fileFilter test to throw error';
          const errorStatus = HttpStatus.I_AM_A_TEAPOT;
          const newHttpError = new HttpException(errorMessage, errorStatus);
          const options: MultipartOptions = {
            fileFilter: (req, file, cb) => cb(newHttpError, false),
          };
          const multipart = new MultipartWrapper(options);
          return expect(
            multipart.any()(req),
          ).to.be.rejected.and.to.eventually.equal(newHttpError);
        });
      });
    });
  });
  describe('fileFields', () => {
    it('should call req.files() with expected options', async () => {
      const options: MultipartOptions = {
        limits: {},
      };
      const multipart = new MultipartWrapper(options);
      const reqSpy = sinon.spy(req, 'files');
      await multipart.fileFields([
        { name: arrayFieldname, maxCount: 10 },
        { name: objectFieldname, maxCount: 10 },
      ])(req);
      expect(reqSpy.called).to.be.true;
      expect(reqSpy.calledWith(options)).to.be.true;
    });
    it('should not call writeFiles() if dest is undefined', async () => {
      const multipart = new MultipartWrapper({
        dest: undefined,
      });
      const writeFileSpy = sinon.spy(multipart, <any>'writeFile');
      await multipart.fileFields([
        { name: arrayFieldname, maxCount: 10 },
        { name: objectFieldname, maxCount: 10 },
      ])(req);
      expect(writeFileSpy.called).to.be.false;
    });
    it('should call writeFile() with expected params when dest is defined', async () => {
      const options: MultipartOptions = {
        dest: 'upload/test',
      };
      const multipart = new MultipartWrapper(options);
      const writeFileSpy = sinon.spy(multipart, <any>'writeFile');
      await multipart.fileFields([
        { name: arrayFieldname, maxCount: 10 },
        { name: objectFieldname, maxCount: 10 },
      ])(req);
      expect(writeFileSpy.called).to.be.true;
      expect(writeFileSpy.getCall(0).calledWith(filesArray[0])).to.be.true;
      expect(writeFileSpy.getCall(1).calledWith(filesArray[1])).to.be.true;
    });
    it("should call multipartFile.file.emit('end') if dest is undefined", async () => {
      (fs as any).existsSync = (path: string) => true;
      fileObject.file = new Readable();
      const emitEndStub = sinon.stub(fileObject.file, 'emit');
      filesArray = [fileObject];
      const multipart = new MultipartWrapper({});
      await multipart.fileFields([
        { name: arrayFieldname, maxCount: 10 },
        { name: objectFieldname, maxCount: 10 },
      ])(req);
      expect(emitEndStub.called).to.be.true;
    });
    describe('uploadFields', () => {
      it('should throw exception if field is not listed in UploadField array', async () => {
        const multipart = new MultipartWrapper({});
        const unknownFieldname = 'unknown-fieldname';
        const unknownFieldFile = { ...fileObject };
        unknownFieldFile.fieldname = unknownFieldname;
        filesArray.push(unknownFieldFile);
        return expect(
          multipart.fileFields([
            { name: arrayFieldname, maxCount: 10 },
            { name: objectFieldname, maxCount: 10 },
          ])(req),
        )
          .to.be.rejected.and.to.eventually.have.property('message')
          .that.is.equal(multipartExceptions.LIMIT_UNEXPECTED_FILE);
      });
      it('should throw exception if files exceed maxCount', async () => {
        const multipart = new MultipartWrapper({});
        const maxCount = filesArray.length - 1;
        return expect(
          multipart.fileFields([
            { name: arrayFieldname, maxCount },
            { name: objectFieldname, maxCount: 1 },
          ])(req),
        )
          .to.be.rejected.and.to.eventually.have.property('message')
          .that.is.equal(multipartExceptions.FST_FILES_LIMIT);
      });
      it('should throw exception if maxCount is zero or negative', async () => {
        const multipart = new MultipartWrapper({});
        return expect(
          multipart.fileFields([
            { name: arrayFieldname, maxCount: 0 },
            { name: objectFieldname, maxCount: -1 },
          ])(req),
        )
          .to.be.rejected.and.to.eventually.have.property('message')
          .that.is.equal(multipartExceptions.FST_FILES_LIMIT);
      });
    });
    describe('options', () => {
      describe('dest', () => {
        it('should call mkdir with expected params', async () => {
          const options: MultipartOptions = {
            dest: 'upload/test',
          };
          const multipart = new MultipartWrapper(options);
          const fsSpy = sinon.spy(fs.promises, 'mkdir');
          await multipart.fileFields([
            { name: arrayFieldname, maxCount: 10 },
            { name: objectFieldname, maxCount: 10 },
          ])(req);
          expect(fsSpy.called).to.be.true;
          expect(fsSpy.calledWith(options.dest, { recursive: true })).to.be
            .true;
        });
      });
      describe('fileFilter', () => {
        it('should return undefined if options.fileFilter callback is (null, false)', async () => {
          const options: MultipartOptions = {
            fileFilter: (req, file, cb) => cb(null, false),
          };
          const multipart = new MultipartWrapper(options);
          const files = await multipart.fileFields([
            { name: arrayFieldname, maxCount: 10 },
            { name: objectFieldname, maxCount: 10 },
          ])(req);
          expect(files).to.be.undefined;
        });
        it('should filter specific file if callback is (null, false)', async () => {
          const fileToFilterInArray: InterceptorFile = filesArray[1];
          const fileToFilter: InterceptorFile = fileObject;
          const options: MultipartOptions = {
            fileFilter: (req, file, cb) => {
              if (
                file.filename === fileToFilter.filename ||
                file.filename === fileToFilterInArray.filename
              ) {
                return cb(null, false);
              }
              cb(null, true);
            },
          };
          const multipart = new MultipartWrapper(options);
          const filesRecord = await multipart.fileFields([
            { name: arrayFieldname, maxCount: 10 },
            { name: objectFieldname, maxCount: 10 },
          ])(req);
          expect(filesRecord[arrayFieldname]).to.not.have.members([
            fileToFilter,
          ]);
          expect(filesRecord[objectFieldname]).to.be.undefined;
        });
        it('should throw error if options.fileFilter callback is (Error, Boolean)', async () => {
          const errorMessage = 'Expect fileFilter test to throw error';
          const errorStatus = HttpStatus.I_AM_A_TEAPOT;
          const newHttpError = new HttpException(errorMessage, errorStatus);
          const options: MultipartOptions = {
            fileFilter: (req, file, cb) => cb(newHttpError, false),
          };
          const multipart = new MultipartWrapper(options);
          return expect(
            multipart.fileFields([
              { name: arrayFieldname, maxCount: 10 },
              { name: objectFieldname, maxCount: 10 },
            ])(req),
          ).to.be.rejected.and.to.eventually.equal(newHttpError);
        });
      });
    });
  });
});
