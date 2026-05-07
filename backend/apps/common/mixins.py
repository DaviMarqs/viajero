from rest_framework import mixins as drf_mixins, status, viewsets
from rest_framework.response import Response

DEFAULT_SUCCESS_MESSAGE = "Operacao realizada com sucesso."
DEFAULT_ERROR_MESSAGE = "Nao foi possivel processar a solicitacao."


class StandardResponseMixin:
    success_messages = {
        "list": "Lista carregada com sucesso.",
        "retrieve": "Registro carregado com sucesso.",
        "create": "Registro criado com sucesso.",
        "update": "Registro atualizado com sucesso.",
        "partial_update": "Registro atualizado com sucesso.",
        "destroy": "Registro removido com sucesso.",
    }
    error_message = DEFAULT_ERROR_MESSAGE

    def get_success_message(self, action=None):
        action_name = action or getattr(self, "action", None)
        return self.success_messages.get(action_name, DEFAULT_SUCCESS_MESSAGE)

    def build_success_payload(self, data, message=None):
        return {
            "success": True,
            "message": message or self.get_success_message(),
            "data": data,
        }

    def build_error_payload(self, errors, message=None):
        return {
            "success": False,
            "message": message or self.error_message,
            "errors": errors,
        }

    def success_response(self, data=None, message=None, status_code=status.HTTP_200_OK):
        return Response(self.build_success_payload(data, message=message), status=status_code)

    def error_response(self, errors=None, message=None, status_code=status.HTTP_400_BAD_REQUEST):
        return Response(self.build_error_payload(errors, message=message), status=status_code)

    def _wrap_response(self, response, message=None):
        if response.status_code == status.HTTP_204_NO_CONTENT:
            response.status_code = status.HTTP_200_OK
            data = None
        else:
            data = response.data
        response.data = self.build_success_payload(data, message=message)
        return response

    def handle_exception(self, exc):
        response = super().handle_exception(exc)
        if response is None:
            return response
        response.data = self.build_error_payload(response.data)
        return response


class StandardModelViewSet(StandardResponseMixin, viewsets.ModelViewSet):
    def list(self, request, *args, **kwargs):
        response = super().list(request, *args, **kwargs)
        return self._wrap_response(response)

    def retrieve(self, request, *args, **kwargs):
        response = super().retrieve(request, *args, **kwargs)
        return self._wrap_response(response)

    def create(self, request, *args, **kwargs):
        response = super().create(request, *args, **kwargs)
        return self._wrap_response(response)

    def update(self, request, *args, **kwargs):
        response = super().update(request, *args, **kwargs)
        return self._wrap_response(response)

    def partial_update(self, request, *args, **kwargs):
        response = super().partial_update(request, *args, **kwargs)
        return self._wrap_response(response)

    def destroy(self, request, *args, **kwargs):
        response = super().destroy(request, *args, **kwargs)
        return self._wrap_response(response)


class StandardRetrieveUpdateViewSet(
    StandardResponseMixin,
    drf_mixins.RetrieveModelMixin,
    drf_mixins.UpdateModelMixin,
    viewsets.GenericViewSet,
):
    def retrieve(self, request, *args, **kwargs):
        response = super().retrieve(request, *args, **kwargs)
        return self._wrap_response(response)

    def update(self, request, *args, **kwargs):
        response = super().update(request, *args, **kwargs)
        return self._wrap_response(response)

    def partial_update(self, request, *args, **kwargs):
        response = super().partial_update(request, *args, **kwargs)
        return self._wrap_response(response)
