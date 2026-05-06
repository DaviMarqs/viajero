from rest_framework import permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.audit.services import audit
from apps.destinations.models import Destination
from .services import FirecrawlIngestionService


class FirecrawlIngestionView(APIView):
    permission_classes = [permissions.IsAdminUser]

    def post(self, request):
        destination = Destination.objects.get(pk=request.data["destination_id"])
        source_urls = request.data.get("source_urls", [])
        result = FirecrawlIngestionService().ingest_destination(destination=destination, source_urls=source_urls)
        audit("firecrawl.ingested", actor=request.user, target=destination, metadata={"source_urls": source_urls, "poi_count": result.poi_count})
        return Response(
            {
                "destination_updated": result.destination_updated,
                "poi_count": result.poi_count,
                "cost_profile_updated": result.cost_profile_updated,
            },
            status=status.HTTP_200_OK,
        )
