import * as fs from 'fs';
import { debug } from 'shared/debug';

export function fileExistsSync(filePath: string): boolean {
    try {
        // Use fs.existsSync to check if the file exists synchronously
        return fs.existsSync(filePath);
    } catch (error) {
        // Handle any errors that occur during the check
        debug.file && console.error('Error checking file existence:', error);
        return false; // File may not exist or other error occurred
    }
}