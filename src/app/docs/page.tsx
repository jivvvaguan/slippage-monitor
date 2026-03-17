import type { Metadata } from 'next';
import { Suspense } from 'react';
import DocsContent from './DocsContent';
import './docs.css';

export const metadata: Metadata = {
  title: 'API Documentation | Slippage Monitor',
  description:
    'Complete API documentation for the Slippage Monitor REST API. Interactive explorer, code examples, and OpenAPI spec.',
};

export default function DocsPage() {
  return (
    <Suspense fallback={<div className="loading-state">Loading documentation...</div>}>
      <DocsContent />
    </Suspense>
  );
}
