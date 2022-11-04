import { UUID } from '@lumino/coreutils';
import { Signal, ISignal } from '@lumino/signaling';
import { ModelDB } from '@jupyterlab/observables';
import { Contents, ServerConnection } from '@jupyterlab/services';
import { PathExt } from '@jupyterlab/coreutils';
import { base64ToBuffer, bufferToBase64 } from '@jupyter-widgets/base-manager';
//import { ENOENT } from 'constants';

type EmscriptenFileModel = {
  name: string;
  path: string;
  type: Contents.ContentType;
  writable: boolean;
  created: string;
  last_modified: string;
  mimetype: string;
  content: any;
  chunk?: number;
  format: Contents.FileFormat;
  size?: number;
  indices?: readonly number[];
};

// eslint-disable-next-line @typescript-eslint/naming-convention
interface ErrnoError extends Error {
  node?: FS.FSNode;
  errno: number;
  message: string;
}

// eslint-disable-next-line @typescript-eslint/naming-convention
interface EMFSStat {
  dev: number;
  ino: number;
  mode: number;
  nlink: number;
  uid: number;
  gid: number;
  rdev: number;
  size: number;
  atime: Date;
  mtime: Date;
  ctime: Date;
  blksize: number;
  blocks: number;
}

// eslint-disable-next-line @typescript-eslint/naming-convention
interface EMFSNode {
  name: string;
}

interface IEMFSCheckpoint extends Contents.ICheckpointModel {
  path: string;
}

interface IPathToContentsOptions {
  getContents: boolean;
}

export type rescanFunction = () => void;

export class EmscriptenDrive implements Contents.IDrive {
  constructor(fs: typeof FS, rescan: rescanFunction) {
    this.fs = fs;
    this.rescan = rescan;
    this.uName = UUID.uuid4();
  }

  uName: string;
  rescan: rescanFunction;
  serverSettings: ServerConnection.ISettings;
  modelDBFactory?: ModelDB.IFactory;

  async get(
    localPath: string,
    options?: Contents.IFetchOptions
  ): Promise<Contents.IModel> {
    const model = await this.pathToContentsModel('', localPath, {
      getContents: true
    });
    if (model.type === 'directory') {
      // Fill with the contents
      model.content = this.fs.readdir('/' + localPath) as Array<string>;
      model.content = await Promise.all(
        model.content.map(
          async (element: string) =>
            await this.pathToContentsModel(localPath, element)
        )
      );
      model.content = model.content.filter((element: any) => element !== null);
      //console.log(model.content);
    }
    return Promise.resolve(model);
  }
  getDownloadUrl(localPath: string): Promise<string> {
    throw new Error('Method not implemented.');
  }
  newUntitled(options?: Contents.ICreateOptions): Promise<Contents.IModel> {
    let newPath: string = undefined;
    let ext = '';
    if (options.type !== 'directory') {
      ext = PathExt.normalizeExtension(options.ext);
    }
    let count = 0;
    while (newPath === undefined) {
      try {
        this.fs.stat(
          '/' + PathExt.join(options.path, 'Untitled' + count + ext)
        );
        count += 1;
      } catch (e) {
        newPath = '/' + PathExt.join(options.path, 'Untitled' + count + ext);
      }
    }
    if (options.type === 'directory') {
      this.fs.mkdir(newPath);
    } else {
      this.fs.writeFile(newPath, '');
    }
    this.rescan();
    return this.pathToContentsModel(
      '/' + options.path,
      PathExt.basename(newPath),
      {
        getContents: true
      }
    );
  }
  delete(localPath: string): Promise<void> {
    this.fs.unlink('/' + localPath);
    this.rescan();
    return new Promise<void>(() => null);
  }
  rename(oldLocalPath: string, newLocalPath: string): Promise<Contents.IModel> {
    this.fs.rename('/' + oldLocalPath, '/' + newLocalPath);
    this.rescan();
    return this.pathToContentsModel('', newLocalPath);
  }
  async save(
    localPath: string,
    options?: Partial<Contents.IModel>
  ): Promise<Contents.IModel> {
    let content: string;
    if (options.format === 'base64') {
      const buffer: Uint8Array = new Uint8Array(
        base64ToBuffer(options.content)
      );
      const s = this.fs.open('/' + localPath, 'w');
      this.fs.write(s, buffer, 0, buffer.length);
      this.fs.close(s);
      this.rescan();
      return this.pathToContentsModel(
        PathExt.dirname(localPath),
        PathExt.basename(localPath)
      );
      // We have to use write() manually here, which requires some allocations.
    }
    if (options.format === 'json') {
      content = JSON.stringify(options.content);
    } else {
      content = options.content;
    }
    // We can't use writeFile for binary data
    //console.log('writing', '/' + localPath);
    this.fs.writeFile('/' + localPath, content);
    //console.log('wrote', '/' + localPath);
    this.rescan();
    return this.pathToContentsModel(
      PathExt.dirname(localPath),
      PathExt.basename(localPath)
    );
  }
  copy(localPath: string, toLocalDir: string): Promise<Contents.IModel> {
    const basename = PathExt.basename(localPath);
    const buffer = this.fs.readFile('/' + localPath);
    this.fs.writeFile('/' + PathExt.join(toLocalDir, basename), buffer);
    this.rescan();
    return this.pathToContentsModel(toLocalDir, basename);
  }

  private _getCheckpointBase(localPath: string): string {
    return '/' + PathExt.join(PathExt.dirname(localPath), '.ipynb_checkpoints');
  }

  createCheckpoint(localPath: string): Promise<Contents.ICheckpointModel> {
    const baseDir = this._getCheckpointBase(localPath);
    let stat: EMFSStat;
    try {
      stat = this.fs.stat(baseDir);
      if (!this.fs.isDir(stat.mode)) {
        throw new Error(`${baseDir} exists and is not a directory!`);
      }
    } catch (e) {
      // Can't figure out where to get ENOENT from, so, ...
      this.fs.mkdir(baseDir);
    }
    const newPathName =
      '/' + PathExt.join(baseDir, PathExt.basename(localPath)) + UUID.uuid4();
    //console.log(`newPathName to try ${newPathName}`);
    this.fs.writeFile(newPathName, '');
    //console.log('wrote the file');
    stat = this.fs.stat(newPathName);
    //console.log('Stat of that new path: ', stat);
    const model: IEMFSCheckpoint = {
      path: newPathName,
      id: '' + stat.ino,
      last_modified: stat.mtime.toISOString()
    };
    this.rescan();
    //console.log('Returning a resolved promise');
    return Promise.resolve(model);
  }
  listCheckpoints(localPath: string): Promise<IEMFSCheckpoint[]> {
    //console.log('Checkpoint Listing', localPath);
    const baseDir = this._getCheckpointBase(localPath);
    let dirContents: Array<string>;
    try {
      dirContents = this.fs.readdir(baseDir);
    } catch (e) {
      //console.log('Error:', e);
      return Promise.resolve([]);
    }
    const models: Array<IEMFSCheckpoint> = [];
    for (const element in dirContents.filter(e => e.startsWith(localPath))) {
      const stat: EMFSStat = this.fs.stat('/' + PathExt.join(baseDir, element));
      models.push({
        id: '' + stat.ino,
        path: '/' + PathExt.join(baseDir, element),
        last_modified: stat.mtime.toISOString()
      });
    }
    return Promise.resolve(models);
  }
  restoreCheckpoint(localPath: string, checkpointID: string): Promise<void> {
    return this.listCheckpoints(localPath).then(checkpointList =>
      checkpointList
        .filter(element => element.id === checkpointID)
        .forEach(element => {
          const buffer = this.fs.readFile(element.path);
          this.fs.writeFile(localPath, buffer);
          this.rescan();
        })
    );
  }
  deleteCheckpoint(localPath: string, checkpointID: string): Promise<void> {
    // Let's grab all the checkpoints, then remove the path
    return this.listCheckpoints(localPath)
      .then(checkpointList =>
        checkpointList
          .filter(element => element.id === checkpointID)
          .forEach(element => this.fs.unlink(element.path))
      )
      .then(() => this.rescan());
  }
  isDisposed: boolean;
  dispose(): void {
    if (this.isDisposed) {
      return;
    }
    this.isDisposed = true;
    Signal.clearData(this);
  }

  fs: typeof FS;

  get name(): string {
    return 'EmscriptenFS-' + this.uName;
  }

  get fileChanged(): ISignal<this, Contents.IChangedArgs> {
    return this._fileChanged;
  }

  private _fileChanged = new Signal<this, Contents.IChangedArgs>(this);

  async pathToContentsModel(
    localPath: string,
    fn: string,
    options: IPathToContentsOptions = { getContents: false }
  ): Promise<EmscriptenFileModel> {
    if (fn === '.') {
      return null;
    }
    let stat: EMFSStat;
    const path = PathExt.join(localPath, fn);
    //console.log(`Trying "${path}"`);
    try {
      stat = this.fs.stat('/' + path);
    } catch (e) {
      console.log(`Issue with getting stat: ${e}`);
      throw e;
    }
    //console.log('Received stat', stat);
    let fileContent: string;
    let content: string = undefined;
    let contentFormat: Contents.FileFormat = 'text';
    let mimeType = 'text/text-plain';
    //console.log(node, stat);
    if (options.getContents && this.fs.isFile(stat.mode)) {
      fileContent = bufferToBase64(
        this.fs.readFile('/' + path, { encoding: 'binary' })
      );
      switch (PathExt.normalizeExtension(PathExt.extname(fn))) {
        case '.json':
          content = JSON.parse(atob(fileContent));
          mimeType = 'application/json';
          contentFormat = 'json';
          break;
        case '.txt':
        case '.TXT':
          //content = atob(this.fs.readFile('/' + path, { encoding: 'utf8' }));
          content = atob(fileContent);
          mimeType = 'text/text-plain';
          contentFormat = 'text';
          break;
        default:
          content = fileContent;
          mimeType = 'application/octet-stream';
          contentFormat = 'base64';
          break;
      }
    }
    const newModel: EmscriptenFileModel = {
      name: fn,
      path: path,
      type: this.fs.isDir(stat.mode) ? 'directory' : 'file',
      writable: true, // always true
      created: stat.ctime.toISOString(),
      last_modified: stat.mtime.toISOString(),
      mimetype: mimeType,
      content: content,
      format: contentFormat,
      size: stat.size
    };
    //console.log('Returning model', newModel);
    return newModel;
  }
}
