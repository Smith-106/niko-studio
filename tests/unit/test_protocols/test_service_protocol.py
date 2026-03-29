"""
Tests for Service Protocol

Verifies ServiceProtocol compliance.
"""

import pytest
from protocols import ServiceProtocol


class MockService:
    """Mock implementation of ServiceProtocol for testing."""
    
    @property
    def name(self) -> str:
        return "test_service"
    
    async def initialize(self, **kwargs):
        pass
    
    async def shutdown(self):
        pass
    
    async def health_check(self) -> bool:
        return True
    
    def get_status(self) -> dict:
        return {
            "name": self.name,
            "status": "healthy",
            "uptime": 3600
        }


class TestServiceProtocol:
    """Tests for ServiceProtocol compliance."""
    
    def test_service_protocol_compliance(self):
        """Verify MockService implements ServiceProtocol protocol."""
        service = MockService()
        assert isinstance(service, ServiceProtocol)
    
    def test_service_has_required_methods(self):
        """Verify ServiceProtocol has all required methods."""
        service = MockService()
        assert hasattr(service, 'name')
        assert hasattr(service, 'initialize')
        assert hasattr(service, 'shutdown')
        assert hasattr(service, 'health_check')
        assert hasattr(service, 'get_status')
    
    @pytest.mark.asyncio
    async def test_service_initialize(self):
        """Test ServiceProtocol.initialize method."""
        service = MockService()
        await service.initialize(config="test")
        # Should not raise
    
    @pytest.mark.asyncio
    async def test_service_shutdown(self):
        """Test ServiceProtocol.shutdown method."""
        service = MockService()
        await service.shutdown()
        # Should not raise
    
    @pytest.mark.asyncio
    async def test_service_health_check(self):
        """Test ServiceProtocol.health_check method."""
        service = MockService()
        result = await service.health_check()
        assert result is True
    
    def test_service_get_status(self):
        """Test ServiceProtocol.get_status method."""
        service = MockService()
        status = service.get_status()
        assert "name" in status
        assert status["name"] == "test_service"
