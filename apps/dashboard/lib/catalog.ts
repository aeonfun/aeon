import { defineCatalog } from "@json-render/core";
import { schema } from "@json-render/react";
import { shadcnComponentDefinitions } from "@json-render/shadcn/catalog";

export const catalog = defineCatalog(schema, {
  components: {
    Card:    shadcnComponentDefinitions.Card,
    Stack:   shadcnComponentDefinitions.Stack,
    Heading: shadcnComponentDefinitions.Heading,
    Text:    shadcnComponentDefinitions.Text,
    Badge:   shadcnComponentDefinitions.Badge,
    Grid:    shadcnComponentDefinitions.Grid,
    Table:     shadcnComponentDefinitions.Table,
    Button:    shadcnComponentDefinitions.Button,
    Link:      shadcnComponentDefinitions.Link,
    Alert:     shadcnComponentDefinitions.Alert,
    Progress:  shadcnComponentDefinitions.Progress,
    Separator: shadcnComponentDefinitions.Separator,
  },
  actions: {},
});

export const CATALOG_PROMPT = catalog.prompt();
