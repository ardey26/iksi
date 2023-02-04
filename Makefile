.PHONY: install
install:
	(cd client && npm install)
	cd server && npm install

.PHONE: build
build:
	docker compose build

.PHONY: start
start:
	docker compose up

.PHONY: setup
setup:
	docker compose build
	docker compose up

.PHONY: rebuild
rebuild:
	docker compose down --rmi all
	docker compose build
	docker compose up
    
.PHONY: acp
acp:
	git add .
	git commit -m "$m"
	git push
	
.PHONY: server
server:
	docker compose up server1
