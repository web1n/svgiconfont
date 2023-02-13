# @web1n/svgiconfont

svg icon to font

## Sample

```ts
await SvgIconFont({
	fontName: 'icon',
	dest: 'output',
	files: [
		'solid/angle-down',
		'solid/arrow-right',
		'solid/plus',
		'solid/up-right-from-square'
	].map(name => {
		return resolve('node_modules', '@fortawesome', 'fontawesome-free', 'svgs', `${name}.svg`);
	})
});
```
