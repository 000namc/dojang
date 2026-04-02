#!/bin/bash
set -e

git config --global user.email "learner@dojang.dev"
git config --global user.name "Learner"
git config --global init.defaultBranch main

mkdir -p /repos

# Scenario 1: basic — init/add/commit 연습
mkdir -p /repos/basic && cd /repos/basic && git init
echo "# My Project" > README.md
echo "hello world" > hello.txt
git add . && git commit -m "Initial commit"

# Scenario 2: branching — 브랜치 연습
mkdir -p /repos/branching && cd /repos/branching && git init
echo "main content" > file.txt
git add . && git commit -m "initial commit on main"
git checkout -b feature
echo "feature work" >> file.txt
echo "new feature file" > feature.txt
git add . && git commit -m "add feature work"
git checkout main

# Scenario 3: conflict — 머지 충돌 연습
mkdir -p /repos/conflict && cd /repos/conflict && git init
echo "line1" > shared.txt
git add . && git commit -m "base commit"
git checkout -b branch-a
echo "change from branch-a" >> shared.txt
git add . && git commit -m "branch-a change"
git checkout main
echo "change from main" >> shared.txt
git add . && git commit -m "main change"

# Scenario 4: rebase — 리베이스 연습
mkdir -p /repos/rebase && cd /repos/rebase && git init
echo "base" > file.txt
git add . && git commit -m "base"
echo "main update 1" >> file.txt
git add . && git commit -m "main update 1"
git checkout -b topic HEAD~1
echo "topic work" > topic.txt
git add . && git commit -m "topic commit 1"
echo "more topic" >> topic.txt
git add . && git commit -m "topic commit 2"
git checkout main

# Scenario 5: history — log/diff 연습
mkdir -p /repos/history && cd /repos/history && git init
echo "v1" > app.py
git add . && git commit -m "feat: initial version"
echo "v2" > app.py
git add . && git commit -m "fix: bug fix in app"
echo "v3" > app.py
echo "test" > test.py
git add . && git commit -m "feat: add tests"
echo "v4" > app.py
git add . && git commit -m "refactor: clean up code"
