import fs from 'fs';
import path from 'path';
import Promise from 'bluebird';
import electron from 'electron';
import globby from 'globby';

import store from '../store';
import utils from '../utilities/utils';

import keys from '../keys/keyfile';
import AppActions from './AppActions';
import app from '../lib/app';

const dialog = electron.remote.dialog;
const realpathAsync = Promise.promisify(fs.realpath);

const load = () => {
    const querySort = {
        'title': 1,
        'year': 1,
        'disk.no': 1,
        'track.no': 1
    };
    app.models.Song.find().sort(querySort).exec((err, songs) => {
        if (err) console.warn(err);
        else {
            store.dispatch({
                type: keys.REFRESH_LIBRARY,
                songs
            });
        }
    });
};

const addFolders = () => {
    dialog.showOpenDialog({
        properties: ['openDirectory', 'multiSelections']
    }, folders => {
        if (folders !== undefined) {
            Promise.map(folders, folder => {
                return realpathAsync(folder);
            }).then(resolvedFolders => {
                store.dispatch({
                    type: keys.LIBRARY_ADD_FOLDERS,
                    folders: resolvedFolders
                });
            }).then(()=>refresh());
        }
    });
};

const removeFolder = index => {
    store.dispatch({
        type: keys.LIBRARY_REMOVE_FOLDER,
        index
    });
};

const refresh = () => {
    store.dispatch({
        type: keys.LIBRARY_REFRESH_START
    });

    const folders = app.config.get('musicFolders');
    const fsConcurrency = 32;

    const getMetadataAsync = track => {
        return new Promise(resolve => {
            utils.getMetadata(track, resolve);
        });
    };

    app.models.Song.removeAsync({}, { multi: true }).then(() => {
        return Promise.map(folders, folder => {
            const pattern = path.join(folder, '**/*.*');
            return globby(pattern, { nodir: true, follow: true });
        });
    }).then(filesArrays => {
        return filesArrays
            .reduce((acc, array) => acc.concat(array), [])
            .filter(filePath => app.supportedExtensions.includes(
                    path.extname(filePath).toLowerCase())
            );
    }).then(supportedFiles => {
        let addedFiles = 0;
        const totalFiles = supportedFiles.length;
        return Promise.map(supportedFiles, filePath => {
            return app.models.Song.findAsync({ path: filePath }).then(docs => {
                if (docs.length === 0) {
                    return getMetadataAsync(filePath);
                }
                return docs[0];
            }).then(song => app.models.Song.insert(song))
            .then(() => {
                const percent = parseInt(addedFiles * 100 / totalFiles);
                // console.log(percent);
                addedFiles++;
            }, { concurrent: fsConcurrency });
        }).then(() => {
            AppActions.library.load();
            store.dispatch({
                type: keys.LIBRARY_REFRESH_END
            });
        }).catch(err => console.warn(err));
    });

};

export default {
    load,
    addFolders,
    removeFolder,
    refresh
};