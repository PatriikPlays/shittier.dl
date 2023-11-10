<h1 align="center">Shittier.download</h1>
<div align="center">
  <a href="https://github.com/pixium/shittier.dl">
    <img alt="github icon" height="56" src="https://cdn.jsdelivr.net/npm/@intergrav/devins-badges@3/assets/cozy/available/github_vector.svg">
  </a>
  <img alt="pc icon" height="56" src="https://cdn.jsdelivr.net/npm/@intergrav/devins-badges@3/assets/cozy/supported/pc_vector.svg">
  <img alt="risugamis-modloader icon" height="56" src="https://cdn.jsdelivr.net/npm/@intergrav/devins-badges@3/assets/cozy/unsupported/risugamis-modloader_vector.svg">
</div>

Inspired by [shitty.dl], here comes shittier.dl! Simply said, shittier.dl is a simple file cdn for private use.

## Developing

Thanks for your interest in shittier.dl!
To get started you need to install the [Bun](https://bun.sh) typescript runtime.

To run:

```bash
bun run start
```

## Vocabulary

| Term         | Definition                                                   | Example                                                             |
| ------------ | ------------------------------------------------------------ | ------------------------------------------------------------------- |
| File         | A file                                                       | `magicalFile.png`                                                   |
| Public file  | A file publicly accessible by anyone with the URL            | `https://i.example.com/publicFile.png`                              |
| Private file | A file only accessible by logged in users                    | `https://i.example.com/privateFile.png`                             |
| Link         | A a long URL to access a private file without authentication | `https://i.example.com/access/da312845-3ce1-4bbf-93ae-b6c6ab0a3306` |
| Redirect     | A short URL that redirects to a long URL                     | `https://i.example.com/redirectMe`                                  |

## Todo

- Index files in db

[shitty.dl]: https://github.com/tmpim/shitty.dl
