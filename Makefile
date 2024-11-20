.DEFAULT_GOAL := build
DIST_DIR := dist
SRC_DIR := src

.PHONY: build
build: clean $(DIST_DIR)/cjs $(DIST_DIR)/mjs 

.PHONY: clean
clean:
	@rm -rf $(DIST_DIR)

SRC_FILES := $(shell find src -type f)

$(DIST_DIR)/cjs: node_modules tsconfig-cjs.json $(SRC_FILES)
	@{ \
		trap '{ rm $(SRC_DIR)/package.json; exit 1; }' ERR; \
		echo "{\"type\":\"commonjs\"}" > $(SRC_DIR)/package.json; \
		npx tspc -p tsconfig-cjs.json; \
		mv $(SRC_DIR)/package.json $@/; \
		touch $@; \
	}

$(DIST_DIR)/mjs: node_modules tsconfig-mjs.json $(SRC_FILES)
	@{ \
		trap '{ rm $(SRC_DIR)/package.json; exit 1; }' ERR; \
		echo "{\"type\":\"module\"}" > $(SRC_DIR)/package.json; \
		npx tspc -p tsconfig-mjs.json; \
		mv $(SRC_DIR)/package.json $@/; \
		touch $@; \
	}

$(DIST_DIR)/test: node_modules tsconfig.json $(SRC_FILES)
	@{ \
		trap '{ rm $(SRC_DIR)/package.json; exit 1; }' ERR; \
		echo "{\"type\":\"module\"}" > $(SRC_DIR)/package.json; \
		npx tspc -p tsconfig.json; \
		mv $(SRC_DIR)/package.json $@/; \
		touch $@; \
	}

node_modules: package-lock.json
	@npm ci --force
	@touch $@

package-lock.json: package.json
	@npm i --force
	@touch $@

tsconfig-cjs.json: tsconfig-base.json
	@touch $@

tsconfig-mjs.json: tsconfig-base.json
	@touch $@

tsconfig.json: tsconfig-base.json
	@touch $@