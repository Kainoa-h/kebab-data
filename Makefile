LLMS_DIR     := ./llms
MODEL_REPO   := unsloth/Qwen3.5-9B-GGUF
MODEL_FILE   := Qwen3.5-9B-Q4_K_M.gguf
MODEL_PATH   := $(LLMS_DIR)/$(MODEL_FILE)
PORT         := 8080
CTX_SIZE     := 8192
N_GPU_LAYERS := 99

.PHONY: help download server

help: ## Show this help message
	@echo "Available commands:"
	@echo "  make download  - Download the model from Hugging Face"
	@echo "  make server    - Start the llama-server"

download: ## Download the Qwen Q4_K_M model from HuggingFace
	huggingface-cli download $(MODEL_REPO) $(MODEL_FILE) --local-dir $(LLMS_DIR)

server: ## Start llama-server with the downloaded model
	@if [ ! -f "$(MODEL_PATH)" ]; then \
		echo "No model found at $(MODEL_PATH). Run 'make download' first."; \
		exit 1; \
	fi
	llama-server \
		--model $(MODEL_PATH) \
		--port $(PORT) \
		--ctx-size $(CTX_SIZE) \
		--n-gpu-layers $(N_GPU_LAYERS)
