import { GPTSoVITSProvider } from './dist/tts/providers/GPTSoVITSProvider.js';

async function benchmark() {
  const provider = new GPTSoVITSProvider();
  const request = {
    text: "H-hmph. I'm not exactly the date-ginger. You're my creator, not some. romantic interest.",
    emotion: "neutral",
    intensity: 0.5
  };

  for (let i = 1; i <= 3; i++) {
    console.log(`\n--- Run ${i} ---`);
    const start = performance.now();
    try {
      await provider.synthesize(request);
      const end = performance.now();
      console.log(`Latency: ${((end - start) / 1000).toFixed(3)}s`);
    } catch (e) {
      console.error(e);
    }
  }
}

benchmark();

