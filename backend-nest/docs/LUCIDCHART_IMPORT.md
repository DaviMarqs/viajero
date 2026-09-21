# Importar diagrama de classes no Lucidchart

Arquivo principal:

```text
backend-nest/docs/lucidchart-class-diagram.mmd
```

## Como importar

1. Abra um documento no Lucidchart.
2. Use a opção **Diagram as Code** / **Mermaid**.
3. Cole o conteúdo inteiro de `lucidchart-class-diagram.mmd`.
4. Renderize o diagrama.
5. Se quiser editar visualmente, ajuste o layout no canvas do Lucidchart após a importação.

## Conteúdo do diagrama

O arquivo contém:

- módulos NestJS;
- controllers;
- services;
- DTOs;
- entities TypeORM;
- interfaces principais;
- relações entre entidades;
- dependências entre controllers/services;
- os Design Patterns usados no projeto:
  - Facade;
  - Adapter;
  - Composite;
  - Decorator;
  - Singleton;
  - Factory;
  - Builder.

## Observação

O diagrama é completo e, por isso, grande. Para apresentação acadêmica, uma boa estratégia é importar este arquivo no Lucidchart e duplicar páginas/áreas focando em:

- visão geral dos módulos;
- entidades e relacionamentos;
- fluxo dos Design Patterns;
- camada Controller → Service → TypeORM.
