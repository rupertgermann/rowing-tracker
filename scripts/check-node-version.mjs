const minimum = [22, 12, 0];
const current = process.versions.node.split(".").map(Number);

let isSupported = true;

for (let index = 0; index < minimum.length; index += 1) {
  if (current[index] > minimum[index]) break;
  if (current[index] < minimum[index]) {
    isSupported = false;
    break;
  }
}

if (!isSupported) {
  console.error(
    `Node.js ${minimum.join(".")} or newer is required. Current version: ${process.versions.node}.`
  );
  console.error("Run `nvm install && nvm use` from the repo root, then run `npm install` again.");
  process.exit(1);
}
