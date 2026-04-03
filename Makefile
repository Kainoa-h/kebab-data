LLMS_DIR     := ./llms
MODEL_REPO   := unsloth/Qwen3.5-9B-GGUF
MODEL_FILE   := Qwen3.5-9B-Q4_K_M.gguf
MMPROJ_FILE  := mmproj-F16.gguf
MODEL_PATH   := $(LLMS_DIR)/$(MODEL_FILE)
MMPROJ_PATH  := $(LLMS_DIR)/$(MMPROJ_FILE)
PORT         := 8080
CTX_SIZE     := 8192
N_GPU_LAYERS := 99

.PHONY: help download server

help: ## Show this help message
	@echo "Available commands:"
	@echo "  make download  - Download the model and projector from Hugging Face"
	@echo "  make server    - Start the llama-server with multimodal support"

download: ## Download the Qwen Q4_K_M model and F16 projector from HuggingFace
	hf download $(MODEL_REPO) $(MODEL_FILE) --local-dir $(LLMS_DIR)
	hf download $(MODEL_REPO) $(MMPROJ_FILE) --local-dir $(LLMS_DIR)

server: ## Start llama-server with the downloaded model and projector
	@if [ ! -f "$(MODEL_PATH)" ]; then \
		echo "No model found at $(MODEL_PATH). Run 'make download' first."; \
		exit 1; \
	fi
	@if [ ! -f "$(MMPROJ_PATH)" ]; then \
		echo "No projector found at $(MMPROJ_PATH). Run 'make download' first."; \
		exit 1; \
	fi
	llama-server \
		--model $(MODEL_PATH) \
		--mmproj $(MMPROJ_PATH) \
		--port $(PORT) \
		--ctx-size $(CTX_SIZE) \
		--n-gpu-layers $(N_GPU_LAYERS)
