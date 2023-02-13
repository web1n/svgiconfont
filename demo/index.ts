import SvgIconFont from '../src';
import {resolve} from 'path';


(async () => {
	const numbers = Array.from({length: 10}).map((_, number) => number.toString());

	await SvgIconFont({
		fontName: 'icon',
		dest: 'test-output',
		types: ['ttf', 'woff', 'woff2'],
		files: numbers.map((_, name) => {
			return resolve(__dirname, 'svg', `${name}.svg`);
		}),
		codepoints: Object.assign({}, ...numbers.map(number => ({
			[number]: number.charCodeAt(0)
		})))
	});
})();
