import type {Metadata} from 'svgicons2svgfont';

import SvgIcons2Font from 'svgicons2svgfont';
import Svg2Ttf from 'svg2ttf';
import Ttf2Woff from 'ttf2woff';
import {compress as Ttf2Woff2} from 'wawoff2';

import * as fs from 'fs';
import * as path from 'path';


const DEFAULT_BASE_SELECTOR = '.icon';
const DEFAULT_CLASS_PREFIX = 'icon-';
const DEFAULT_START_CODEPOINT = 0xf101;
const DEFAULT_FILE_OUTPUTS: Font[] = ['woff2', 'woff'];

type Font = 'svg' | 'ttf' | 'woff' | 'woff2';

interface CssOptions {
	/**
	 * @default icon-
	 */
	classPrefix?: string | undefined;
	/**
	 * @default .icon
	 */
	baseSelector?: string | undefined;
}

interface SvgIcons2FontOptions {
	/**
	 * The font id you want (Default value: the options.fontName)
	 *
	 * @default the options.fontName value
	 */
	fontId?: string | undefined;
	/**
	 * The font style you want.
	 */
	fontStyle?: string | undefined;
	/**
	 * The font weight
	 */
	fontWeight?: string | undefined;
	/**
	 * Creates a monospace font of the width of the largest input icon.
	 */
	fixedWidth?: boolean | undefined;
	/**
	 * Calculate the bounds of a glyph and center it horizontally.
	 */
	centerHorizontally?: boolean | undefined;
	/**
	 * Centers the glyphs vertically in the generated font.
	 * @default false
	 */
	centerVertically?: boolean | undefined;
	/**
	 * Normalize icons by scaling them to the height of the highest icon.
	 */
	normalize?: boolean | undefined;
	/**
	 * The outputted font height (defaults to the height of the highest input icon).
	 */
	fontHeight?: number | undefined;
	/**
	 * Setup SVG path rounding.
	 *
	 * @default 10e12
	 */
	round?: number | undefined;
	/**
	 * The font descent. It is usefull to fix the font baseline yourself.
	 *
	 * Warning: The descent is a positive value!
	 */
	descent?: number | undefined;
	/**
	 * The font ascent.
	 *
	 * Default value: fontHeight - descent
	 *
	 * Use this options only if you know what you're doing.
	 * A suitable value for this is computed for you.
	 */
	ascent?: number | undefined;
}

interface Svg2TTfOptions {
	copyright?: string | undefined;
	description?: string | undefined;
	/**
	 * Unix timestamp (in seconds) to override creation time
	 */
	ts?: number | undefined;
	/**
	 * Manufacturer url
	 */
	url?: string | undefined;
	/**
	 * Font version string, can be Version x.y or x.y
	 * @default 'Version 1.0'
	 */
	version?: string | undefined;
}

interface GenerateOptions {
	/**
	 * Font name
	 */
	fontName: string;
	/**
	 * List of Svg files
	 */
	files: string[];
	/**
	 * Output directory of fonts
	 */
	dest: string;
	/**
	 * Which font type will be generated
	 *
	 * @default ['woff', 'woff2']
	 */
	types?: Font[] | undefined;
	/**
	 * Starting codepoint
	 *
	 * @default 0xf101
	 */
	startCodepoint?: number | undefined;
	/**
	 * Custom codepoint for icon
	 */
	codepoints?: Record<string, number> | undefined;
	/**
	 * Custom name for icon
	 */
	renames?: Record<string, string> | undefined;
	/**
	 * SvgIcons2FontOptions and Svg2TTfOptions
	 */
	options?: SvgIcons2FontOptions & Svg2TTfOptions | undefined;
	/**
	 * Css options
	 */
	cssOptions?: CssOptions | undefined;
}


export default async (options: GenerateOptions) => {
	if (!fs.existsSync(options.dest)) {
		await fs.mkdirSync(options.dest);
	}

	const {font: svg, codepoints} = await generateSvgFont(options);
	const css = generateCssContent(options, codepoints);
	const ttf = Svg2Ttf(svg, options.options).buffer;

	await Promise.all(['css', ...(options.types ?? DEFAULT_FILE_OUTPUTS)].map(async type => {
		const output = path.resolve(options.dest, `${options.fontName}.${type}`);
		const data = async (): Promise<string | NodeJS.TypedArray> => {
			switch (type) {
				case 'css':
					return css;
				case 'ttf':
					return ttf;
				case 'woff':
					return Ttf2Woff(ttf);
				case 'woff2':
					return Ttf2Woff2(Buffer.from(ttf));
				case 'svg':
					return svg;
				default:
					throw Error();
			}
		}

		await fs.writeFileSync(output, await data());
		console.log(`generated ${output}`);
	}));
}

function generateCssContent(options: GenerateOptions, codepoints: Record<string, number>) {
	const selector = options.cssOptions?.baseSelector ?? DEFAULT_BASE_SELECTOR;
	const classPrefix = options.cssOptions?.classPrefix ?? DEFAULT_CLASS_PREFIX;

	const src = (['woff2', 'woff', 'ttf', 'svg'] as Font[]).filter(type => {
		return (options?.types ?? DEFAULT_FILE_OUTPUTS).includes(type);
	}).map(type => {
		const format = type == 'ttf' ? 'truetype' : type;

		return `url("./${options.fontName}.${type}") format("${format}")`
	}).join(',');

	return [
		`@font-face { font-family: ${options.fontName}; src: ${src}; }`,
		`${selector} {
			display: inline-block;

			font-family: ${options.fontName} !important;
			font-style: normal;
			font-variant: normal;

			line-height: 1;
			text-rendering: auto;
			vertical-align: middle;
		}`,
		...Object.entries(codepoints).map(entry => {
			const name = entry[0];
			const value = `\\${entry[1].toString(16)}`;

			return `${selector}.${classPrefix}${name}:before { content: "${value}"; }`;
		})
	].join('\n');
}

async function generateSvgFont(options: GenerateOptions): Promise<{ font: string; codepoints: Record<string, number> }> {
	const codepoints: Record<string, number> = {};
	const names: Record<string, string> = {};
	const fonts: Buffer[] = [];

	const fontStream = new SvgIcons2Font({
		fontName: options.fontName,
		log: () => undefined,

		...options.options
	}).on('data', data => {
		fonts.push(data);
	});

	let currentCodepoint = options.startCodepoint ?? DEFAULT_START_CODEPOINT;

	function newCodepoint() {
		const items: number[] = Object.values(codepoints);

		do {
			currentCodepoint += 1;
		} while (items.includes(currentCodepoint));

		return currentCodepoint;
	}

	// codepoints
	Object.entries(options.codepoints ?? {}).map(([name, codepoint]) => {
		codepoints[name] = codepoint;
	});
	options.files.map(file => {
		const filename = path.parse(file).name;
		const name = options.renames?.[filename] ?? filename;

		if (!codepoints[name]) {
			codepoints[name] = newCodepoint();
		}
		names[file] = name;
	});

	options.files.map(file => {
		const name = names[file];
		const unicode = codepoints[name];

		const glyph = fs.createReadStream(file) as fs.ReadStream & { metadata: Metadata };
		glyph.metadata = {
			name: name,
			unicode: [String.fromCodePoint(unicode)],
			renamed: false,
			path: file
		};

		fontStream.write(glyph);
	});

	fontStream.end();

	return new Promise((resolve, reject) => fontStream.on('error', error => {
		reject(error);
	}).on('finish', () => resolve({
		codepoints: codepoints,
		font: Buffer.concat(fonts).toString()
	})));
}
