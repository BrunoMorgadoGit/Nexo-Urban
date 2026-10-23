const [major, minor, patch] = process.versions.node.split('.').map(Number);
const supported =
  major === 22 && (minor > 22 || (minor === 22 && patch >= 3));

if (!supported) {
  console.error(
    `Este projeto requer Node.js >=22.22.3 <23; encontrado ${process.versions.node}. ` +
      'Ative a versão indicada em .nvmrc antes de instalar dependências.',
  );
  process.exit(1);
}
