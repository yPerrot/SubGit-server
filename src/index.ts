import * as fs from 'fs';
import express from 'express';
import cors from 'cors';
import JSZip from 'jszip';

import { fillZip, generateZip } from './main'

const app = express()
const port = 3000

app.use(cors({
    origin: "https://yperrot.github.io",
}))

app.get('/download', async (req, res) => {
    // Ex: 'https://github.com/yPerrot/Solution_Responsive_devChallenges/tree/main/interior-consultant'
    const githubLink = req.query.link;

    if (typeof githubLink === 'string') {
        let zip = new JSZip();
        try {
            zip = await fillZip(zip, githubLink)
        } catch (error) {
            console.log(error);
            res.status(400).send('Invalid argument');
            return;
        }

        const zipPath = githubLink.split('/').pop() + '.zip';
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
    }
})

app.listen(port, () => {
    console.log(`Example app listening on port ${port}`)
})
