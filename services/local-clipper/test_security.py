import importlib.util
from pathlib import Path
import unittest

import httpx

spec = importlib.util.spec_from_file_location("clipper_security_fixture", Path(__file__).with_name("main.py"))
clipper = importlib.util.module_from_spec(spec)
spec.loader.exec_module(clipper)


class ClipperAccessTests(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self):
        self.client = httpx.AsyncClient(
            transport=httpx.ASGITransport(app=clipper.app, client=("127.0.0.1", 50000)),
            base_url="http://127.0.0.1:4317",
        )

    async def asyncTearDown(self):
        await self.client.aclose()

    async def test_untrusted_websites_cannot_start_jobs(self):
        response = await self.client.post("/clip", headers={"Origin": "https://attacker.invalid"}, json={})
        self.assertEqual(response.status_code, 403)
        self.assertNotIn("access-control-allow-origin", response.headers)

    async def test_only_trusted_origin_can_obtain_pairing(self):
        response = await self.client.get("/health", headers={"Origin": "https://muvidb.com"})
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["pairing_token"], clipper.PAIRING_TOKEN)
        response = await self.client.get("/health")
        self.assertIsNone(response.json()["pairing_token"])

    async def test_jobs_require_the_current_pairing_token(self):
        headers = {"Origin": "https://muvidb.com"}
        response = await self.client.get("/clip/unknown-job", headers=headers)
        self.assertEqual(response.status_code, 401)
        headers["X-Muvidb-Clipper-Token"] = clipper.PAIRING_TOKEN
        response = await self.client.get("/clip/unknown-job", headers=headers)
        self.assertEqual(response.status_code, 404)

    async def test_rebinding_hostnames_are_rejected(self):
        response = await self.client.get("/health", headers={"Host": "attacker.invalid", "Origin": "https://muvidb.com"})
        self.assertEqual(response.status_code, 403)


if __name__ == "__main__":
    unittest.main()
