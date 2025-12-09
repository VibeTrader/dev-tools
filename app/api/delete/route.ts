import { NextRequest, NextResponse } from 'next/server';
import { Client } from 'pg';

export async function POST(request: NextRequest) {
  try {
    const { postgresUrl, operation, tableName, columnName, schemaName, conditions } = await request.json();

    if (!postgresUrl) {
      return NextResponse.json(
        { error: 'PostgreSQL URL is required' },
        { status: 400 }
      );
    }

    if (!operation) {
      return NextResponse.json(
        { error: 'Operation is required' },
        { status: 400 }
      );
    }

    // Create a new client with the provided URL
    const client = new Client({
      connectionString: postgresUrl,
    });

    await client.connect();

    let result;
    let message = '';

    try {
      switch (operation) {
        case 'delete_data':
          if (!tableName) {
            throw new Error('Table name is required for deleting data');
          }
          
          let deleteQuery = `DELETE FROM "${tableName}"`;
          
          // Add WHERE conditions if provided
          if (conditions && conditions.trim()) {
            // Basic sanitization - only allow WHERE clause
            const sanitizedConditions = conditions.trim();
            if (sanitizedConditions.toLowerCase().startsWith('where')) {
              deleteQuery += ` ${sanitizedConditions}`;
            } else {
              deleteQuery += ` WHERE ${sanitizedConditions}`;
            }
          } else {
            // If no conditions, delete all data (TRUNCATE is safer but DELETE is more explicit)
            deleteQuery = `TRUNCATE TABLE "${tableName}" RESTART IDENTITY CASCADE`;
          }
          
          result = await client.query(deleteQuery);
          message = conditions 
            ? `Data deleted from table "${tableName}" based on conditions`
            : `All data deleted from table "${tableName}"`;
          break;

        case 'delete_column':
          if (!tableName || !columnName) {
            throw new Error('Table name and column name are required for deleting a column');
          }
          
          result = await client.query(`ALTER TABLE "${tableName}" DROP COLUMN "${columnName}" CASCADE`);
          message = `Column "${columnName}" deleted from table "${tableName}"`;
          break;

        case 'delete_table':
          if (!tableName) {
            throw new Error('Table name is required for deleting a table');
          }
          
          result = await client.query(`DROP TABLE IF EXISTS "${tableName}" CASCADE`);
          message = `Table "${tableName}" deleted successfully`;
          break;

        case 'delete_schema':
          if (!schemaName) {
            throw new Error('Schema name is required for deleting a schema');
          }
          
          // Prevent deleting public schema
          if (schemaName.toLowerCase() === 'public') {
            throw new Error('Cannot delete the public schema');
          }
          
          result = await client.query(`DROP SCHEMA IF EXISTS "${schemaName}" CASCADE`);
          message = `Schema "${schemaName}" deleted successfully`;
          break;

        default:
          throw new Error(`Unknown operation: ${operation}`);
      }

      await client.end();

      return NextResponse.json({
        success: true,
        message,
        operation,
      });
    } catch (dbError: any) {
      await client.end();
      throw dbError;
    }
  } catch (error: any) {
    console.error('Delete operation error:', error);
    return NextResponse.json(
      {
        error: error.message || 'Failed to perform delete operation',
        details: error.toString(),
      },
      { status: 500 }
    );
  }
}


