import * as fs from 'fs';
import * as path from 'path';

import axios, { AxiosResponse } from 'axios';
import JSZip from 'jszip';

import * as jsdom from 'jsdom';
const { JSDOM } = jsdom;

const TMP_FILE_PATH = '/home/node/tmp'

export async function fillZip(zip: JSZip, path: string) {
	const response = await axios.get(path);

	const dom = new JSDOM(response.data);
	const document = dom.window.document;

	const linkSubElems: NodeListOf<HTMLAnchorElement> = document.querySelectorAll('.Details .Box-row a:first-child')

	const subElemsContent = await getLinksContent(linkSubElems, path);

	for (const subElemContent of subElemsContent) {
		const sourceUrl = subElemContent.config.url!;
		const data = getDataFromURL(sourceUrl);

        const fileName = data.path.split('/').pop()!;

		// Is a file
		if (sourceUrl.includes('https://raw.githubusercontent.com')) {
			await addFileContentToZip(fileName, subElemContent, zip);

		// Is a folder
		} else {
			const subFolder = zip.folder(fileName);

            if (subFolder === null) {
                console.error(`Unable to create ${fileName} folder in the zip.`);
            } else {
                await fillZip(subFolder, sourceUrl);
            }
		}
	}

	return zip;
}

export function generateZip(zip: JSZip, fileName: string) {
    return new Promise<void>((resolve, reject) => {
        zip.generateNodeStream({ 
            type: 'nodebuffer', 
            streamFiles: true,
        })
		.pipe(fs.createWriteStream(fileName))
        .on('finish', () => {
            removeAllFileFromFolder(TMP_FILE_PATH);
            resolve();
        })
        .on('error', (err) => {
			console.log(err);
			reject(err)
		})
    })
}

/*************
 **  UTILS  **
 *************/

interface urlData {
    user: string, 
    repo: string, 
    path: string,
}

async function addFileContentToZip(fileName: string, subElemContent: AxiosResponse<any, any>, zip: JSZip) {
	const filePath = path.join(TMP_FILE_PATH, fileName)
	if (!fs.existsSync(TMP_FILE_PATH)) await fs.promises.mkdir(TMP_FILE_PATH)

	const file = fs.createWriteStream(filePath);

	subElemContent.data.pipe(file);

	await new Promise((resolve, reject) => {
		file.on('finish', resolve);
		file.on('error', reject);
	});

	var f = fs.readFileSync(filePath);
	zip.file(fileName, f, { base64: true });
}

async function getLinksContent(linkSubElems: NodeListOf<HTMLAnchorElement>, path: string) {
	const subElemsContentPromise = Array.from(linkSubElems)
		.filter((subElem) => !subElem.href.includes('/commit/')) // Remove commit link
		.filter((subElem) => { // Remove parent folder link (ex: /<user_name>/<repo_name>)
			return subElem.href.split('/').length > 3 
				&& 'https://github.com' + subElem.href !== path.split('/').slice(0, -1).join('/')
		}) 
		.map((subElem) => {
			let url = 'https://github.com' + subElem.href;
			if (url.includes('/blob/main/')) url = getRawContentURL(url);

			return axios.get(url, { responseType: 'stream' });
		});

	return await Promise.all(subElemsContentPromise);
}

function getRawContentURL(url: string) {
	const { user, repo, path} = getDataFromURL(url);
	return `https://raw.githubusercontent.com/${user}/${repo}/main/${path}`;
}

/*
Ex: https://github.com/yPerrot/Solution_Responsive_devChallenges/tree/main/checkout-page/style
Ex: https://raw.githubusercontent.com/yPerrot/Calculator/main/src/App.css
*/
function getDataFromURL(url: string): urlData {
    const urlWithoutDomain = url.replace('https://github.com/', '').replace('https://raw.githubusercontent.com/', '');
    const splitedPartialURL = urlWithoutDomain.split('/');

	const startPathIndex = url.indexOf('/main/') + '/main/'.length;

    return {
        user: splitedPartialURL[0],
        repo: splitedPartialURL[1],
        path: url.slice(startPathIndex)
    }
}

// FROM: https://stackoverflow.com/questions/27072866/how-to-remove-all-files-from-directory-without-removing-directory-in-node-js
function removeAllFileFromFolder(directory: string) {
    fs.readdir(directory, (err, files) => {
        if (err) throw err;

        for (const file of files) {
            fs.unlink(path.join(directory, file), err => {
                if (err) throw err;
            });
        }
    });
}
