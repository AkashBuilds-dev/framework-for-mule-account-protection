import path from 'node:path';
import { FileBlob, PresentationFile } from '@oai/artifact-tool';

const sourcePath = 'C:/Users/akash/Downloads/Copy of SIH2025-IDEA-Presentation-Format.pptx';
const deck = await PresentationFile.importPptx(await FileBlob.load(sourcePath));
const result = await deck.inspect({ kind: 'slide,textbox,shape,image,table,chart,notes,layout', maxChars: 40000 });
console.log(result.ndjson);
