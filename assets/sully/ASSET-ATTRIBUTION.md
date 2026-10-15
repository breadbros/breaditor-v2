# Farmsville demo assets

Copied byte-for-byte from the user's SullyRPG checkout, under
`Examples/Sully/SullyContent`, for the Breaditor Farmsville map demo.
`asset-manifest.json` records the repository URL, source revision, original
relative paths, byte lengths, and SHA-256 hashes for all 107 source files.

The bundle contains the Farmsville map definition/data, art and obstruction
tilesets, referenced Crustacean sprite definitions and images, and the existing
map-editor configuration. The original filenames, JSON, and relative reference
layout are retained. Game scripts, music, and unrelated content are excluded.

No asset license or individual art attribution was found in the source root
README files or alongside these definitions. Breaditor's code license does not
grant rights to this artwork. This provenance record makes no additional license
claim; retain the source project's rights and attribution information if supplied.

To refresh from a Sully content root:

```powershell
node build-infrastructure/sully-assets.js --copy D:/dev/breadbros/SullyRPG/Examples/Sully/SullyContent
```

The copy command replaces the known dependency files and manifest, and never
deletes files. Verify without the source checkout:

```powershell
node build-infrastructure/sully-assets.js --verify
node build-infrastructure/sully-assets.js --verify dist/app/assets/sully
```
