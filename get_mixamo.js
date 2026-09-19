const fs = require('fs');
const https = require('https');

https.get('https://raw.githubusercontent.com/pixiv/three-vrm/dev/packages/three-vrm/examples/mixamoAnimation.html', (res) => {
  let data = '';
  res.on('data', (chunk) => data += chunk);
  res.on('end', () => {
    fs.writeFileSync('mixamo_example.html', data);
    console.log("Downloaded");
  });
}).on('error', (err) => console.log(err));
