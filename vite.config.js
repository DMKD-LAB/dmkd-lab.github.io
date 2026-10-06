import { defineConfig } from 'vite';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { routes } from './src/routes.js';

// Real HTML entry files keep direct links and reloads working on GitHub Pages.
export default defineConfig({
  plugins: [{
    name: 'github-pages-routes',
    async writeBundle(options) {
      const output=resolve(options.dir || 'dist');
      const html=await readFile(join(output,'index.html'),'utf8');
      for(const page of Object.values(routes).filter(page=>page.path!=='/')){
        const directory=join(output,page.path.replace(/^\/+|\/+$/g,''));
        await mkdir(directory,{recursive:true});
        await writeFile(join(directory,'index.html'),html.replace('<title>DMKD Lab · Duksung Women\'s University</title>',`<title>${page.label} · DMKD Lab</title>`));
      }
      await writeFile(join(output,'404.html'),html);
    },
  }],
});
