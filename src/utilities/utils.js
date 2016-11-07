import mmd from 'musicmetadata';
import fs from 'fs';
import path from 'path';

const utils = {

    isNullOrEmpty: variable => (
        variable === null || 
        variable.length === 0 || 
        variable === ''
    ),

    getAudioDuration: (audiopath, callback = () => {}) => {
        const audio = new Audio();
        
        audio.addEventListener('loadedmetadata', () => {
            callback(null, audio.duration);
        });

        audio.addEventListener('error', e => {
            const message = `Error getting the audio duration: (${e.target.error.code}) ${path}`;
            callback(new Error(message), 0);
        });

        audio.preload = 'metadata';
        audio.src = audiopath;
    },

    getMetadata: (track, callback) => {
        const stream = fs.createReadStream(track);
        mmd(stream, { duration: true }, (err, data) => {
            if (err) console.warn(`An error occured while reading ${track} id3 tags: ${err}`);
            
            const metadata = {
                album: utils.isNullOrEmpty(data.album) ? 
                    'Unknown' : data.album,
                albumartist: utils.isNullOrEmpty(data.albumartist) ? 
                    ['Unknown Artist'] : data.albumartist,
                artist: utils.isNullOrEmpty(data.artist) ? 
                    ['Unknown Artist'] : data.artist,
                title: utils.isNullOrEmpty(data.title) ? 
                    path.parse(track).base : data.title,
                year: data.year,
                track: data.track,
                disk: data.disk,
                genre: data.genre,
                path: track,
                playCount: 0,
                duration: data.duration
            };

            if (metadata.duration === 0) {
                utils.getAudioDuration(track, (_err, duration) => {
                    if (_err) console.warn(duration);
                    
                    metadata.duration = duration;
                    callback(metadata);    
                });
            } else {
                callback(metadata);
            }
        });
    },
    removeUselessFolders: folders => {
        //duplicates removal
        const filteredFolders = folders.filter((elem, index) => 
             folders.indexOf(elem) === index
        );

        const foldersToBeRemoved = [];

        filteredFolders.forEach((folder, i) => filteredFolders.forEach((subFolder, j) => {
            if (subFolder.includes(folder) && i !== j && !foldersToBeRemoved.includes(folder)) {
                foldersToBeRemoved.push(subFolder);
            }
        }));

        return filteredFolders.filter(elem => !foldersToBeRemoved.includes(elem));
    },
    getFormatted(type, data) {
        switch (type) {
            case ('SONG_COUNT') : {
                return data.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
            }
            case ('TOTAL_DURATION') : {
                const time = parseInt(data, 10);
                const hours = parseInt(time / 3600, 10);
                const minutes = parseInt((time % 3600) / 60, 10);
                return hours.toString().concat('hr '.concat(minutes.toString()).concat('min'));
            }
            default: {
                return data;
            }
        }
    }
};

export default utils;