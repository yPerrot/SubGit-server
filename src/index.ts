import * as fs from 'fs';
import express from 'express';
import cors from 'cors';
import JSZip from 'jszip';

import { fillZip, generateZip } from './zipUtils'

const app = express()
const port = 8080

app.use(cors({
    origin: "https://subgit.netlify.app",
}))

app.get('/download', async (req, res) => {
    const githubURL = req.query.url;

    if (typeof githubURL === 'string') {
        let zip = new JSZip();
        try {
            zip = await fillZip(zip, githubURL)
        } catch (error) {
            console.log(error);
            res.status(500).send('Unable to download files');
            return;
        }

        const zipPath = githubURL.split('/').pop() + '.zip';
        await generateZip(zip, zipPath)
        
        res.download(zipPath, zipPath, (err) => {
            if (err) {
                console.log(err);
                res.status(500).send('Unable to create ZIP file');
                return;
            }
            
            fs.unlink(zipPath, (err) => {
                if (err) console.log(err);
            })
        });
    } else {
        res.status(400).send('Invalid argument');
    }
})

app.listen(port, () => {
    console.log(`App runs on http://localhost:${port}`)
})
