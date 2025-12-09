import { NextRequest, NextResponse } from 'next/server';
import { Client } from 'pg';

export async function POST(request: NextRequest) {
  try {
    const { postgresUrl } = await request.json();

    if (!postgresUrl) {
      return NextResponse.json(
        { error: 'PostgreSQL URL is required' },
        { status: 400 }
      );
    }

    // Create a new client with the provided URL
    const client = new Client({
      connectionString: postgresUrl,
    });

    await client.connect();

    // Get all table names
    const tablesResult = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_type = 'BASE TABLE'
      ORDER BY table_name;
    `);

    const tables = tablesResult.rows.map((row) => row.table_name);

    if (tables.length === 0) {
      await client.end();
      return NextResponse.json({
        tables: [],
        message: 'No tables found in the database',
      });
    }

    // Get data from all tables and column information
    const allData: Record<string, any[]> = {};
    const tableColumns: Record<string, string[]> = {};

    for (const tableName of tables) {
      try {
        // Get column names from information_schema
        const columnsResult = await client.query(`
          SELECT column_name 
          FROM information_schema.columns 
          WHERE table_schema = 'public' 
          AND table_name = $1
          ORDER BY ordinal_position;
        `, [tableName]);
        
        tableColumns[tableName] = columnsResult.rows.map((row) => row.column_name);
        
        // Get data from table
        const result = await client.query(`SELECT * FROM "${tableName}" LIMIT 1000;`);
        allData[tableName] = result.rows;
      } catch (error) {
        console.error(`Error querying table ${tableName}:`, error);
        allData[tableName] = [];
        tableColumns[tableName] = [];
      }
    }

    await client.end();

    return NextResponse.json({
      tables,
      data: allData,
      columns: tableColumns,
    });
  } catch (error: any) {
    console.error('Database connection error:', error);
    return NextResponse.json(
      {
        error: error.message || 'Failed to connect to database',
        details: error.toString(),
      },
      { status: 500 }
    );
  }
}

