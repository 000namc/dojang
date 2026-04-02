import docker


class ContainerService:
    def __init__(self):
        self.client = docker.from_env()

    def execute_sql(self, container_name: str, sql: str) -> dict:
        container = self.client.containers.get(container_name)
        escaped = sql.replace("\\", "\\\\").replace('"', '\\"').replace("$", "\\$")
        cmd = f'mysql -u root -pdojang practice -e "{escaped}" --batch --raw'
        exit_code, output = container.exec_run(cmd, demux=True)
        stdout = (output[0] or b"").decode() if isinstance(output, tuple) else (output or b"").decode()
        stderr = (output[1] or b"").decode() if isinstance(output, tuple) else ""

        if exit_code != 0:
            return {
                "result_type": "error",
                "output": stderr or stdout,
                "error": stderr or stdout,
                "columns": None,
                "rows": None,
            }

        lines = stdout.strip().split("\n") if stdout.strip() else []
        if not lines:
            return {
                "result_type": "table",
                "output": "Query OK",
                "error": None,
                "columns": [],
                "rows": [],
            }

        columns = lines[0].split("\t")
        rows = [line.split("\t") for line in lines[1:]]
        return {
            "result_type": "table",
            "output": stdout,
            "error": None,
            "columns": columns,
            "rows": rows,
        }

    def execute_shell(self, container_name: str, command: str, workdir: str = "/workspace") -> dict:
        """Execute a shell command — used for CLI and Docker domains."""
        container = self.client.containers.get(container_name)
        cmd = ["bash", "-c", f"cd {workdir} && {command}"]
        exit_code, output = container.exec_run(cmd, demux=True)
        stdout = (output[0] or b"").decode() if isinstance(output, tuple) else (output or b"").decode()
        stderr = (output[1] or b"").decode() if isinstance(output, tuple) else ""

        if exit_code != 0:
            return {
                "result_type": "terminal",
                "output": stdout,
                "error": stderr or stdout,
                "columns": None,
                "rows": None,
            }

        return {
            "result_type": "terminal",
            "output": stdout,
            "error": None,
            "columns": None,
            "rows": None,
        }

    def execute_git(self, container_name: str, command: str, repo: str = "basic") -> dict:
        container = self.client.containers.get(container_name)
        cmd = ["bash", "-c", f"cd /repos/{repo} && {command}"]
        exit_code, output = container.exec_run(cmd, demux=True)
        stdout = (output[0] or b"").decode() if isinstance(output, tuple) else (output or b"").decode()
        stderr = (output[1] or b"").decode() if isinstance(output, tuple) else ""

        if exit_code != 0:
            return {
                "result_type": "terminal",
                "output": stdout,
                "error": stderr or stdout,
                "columns": None,
                "rows": None,
            }

        return {
            "result_type": "terminal",
            "output": stdout,
            "error": None,
            "columns": None,
            "rows": None,
        }
