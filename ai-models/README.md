# Local AI Models

This directory contains instructions and resources for running Ada's local LLM environment.

## Selected Model
- **Model:** Qwen3-4B (Instruction Tuned)
- **Quantization:** Q4_K_M (Provides the best balance between speed and quality)
- **VRAM Requirement:** ~2.5GB, which perfectly fits within the 4GB limit of your NVIDIA RTX 3050 Laptop GPU, allowing for full GPU offloading.
- **Model Location:** The model file should be downloaded directly into this directory (`ai-models/qwen3-4b-q4_k_m.gguf`).

## llama.cpp Installation & Build (Fedora + NVIDIA CUDA)
Given your Fedora environment and CUDA 13.0, compiling `llama.cpp` from source with CMake is the cleanest and most performant approach to leverage your RTX 3050.

1. **Install Build Dependencies (if not already installed):**
   ```bash
   sudo dnf install git make cmake gcc gcc-c++ cuda-toolkit
   ```

2. **Clone and Build:**
   ```bash
   git clone https://github.com/ggerganov/llama.cpp
   cd llama.cpp
   cmake -B build -DGGML_CUDA=ON
   cmake --build build --config Release -j$(nproc)
   ```

3. **Download the Model:**
   You can download the model into the `ai-models` folder using `wget`. *(Note: Replace the URL with the exact Hugging Face URL if Qwen3-4B is hosted under a specific quantizer's repository like `bartowski`)*.
   ```bash
   wget -O ../ai-models/qwen3-4b-q4_k_m.gguf "https://huggingface.co/Qwen/Qwen3-4B-Instruct-GGUF/resolve/main/qwen3-4b-instruct-q4_k_m.gguf"
   ```

## Running the Local Model Server
`llama.cpp` provides a highly efficient, OpenAI-compatible API server. We'll offload all layers to your GPU (`-ngl 99`).

```bash
# Run this from inside the llama.cpp directory
./build/bin/llama-server -m ../ai-models/qwen3-4b-q4_k_m.gguf -c 4096 -ngl 99 --port 8080
```
*Note: `-c 4096` sets the context window to 4K tokens.*

## Testing the Server
Once the server is up and running, you can verify it in a new terminal window by sending a standard OpenAI-formatted API request:

```bash
curl http://127.0.0.1:8080/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{
    "messages": [
      {
        "role": "system",
        "content": "You are Ada, a helpful AI companion."
      },
      {
        "role": "user",
        "content": "Hello Ada, are your neural networks online?"
      }
    ],
    "temperature": 0.7
  }'
```
