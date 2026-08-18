import { NextResponse } from 'next/server';

/**
 * Sanitizes and formats API error responses to prevent information disclosure (CWE-209).
 * Ensures PostgreSQL internal errors, SQL syntax, table schemas, and UUID formats are never leaked.
 *
 * @param {Error|Object} err - The error caught
 * @param {number} defaultStatus - Default HTTP status code (default: 500)
 * @returns {NextResponse}
 */
export function sendApiError(err, defaultStatus = 500) {
    if (process.env.NODE_ENV !== 'production' || defaultStatus >= 500) {
        console.error('API Error Handler caught error:', err);
    }

    let status = err?.status || defaultStatus;
    const rawMessage = String(err?.message || '');
    const errCode = String(err?.code || '');
    let message = 'Terjadi kesalahan pada server. Silakan coba lagi.';

    // 1. PostgreSQL specific errors (e.g. 22P02 invalid input syntax for uuid/int)
    if (errCode === '22P02' || rawMessage.toLowerCase().includes('invalid input syntax')) {
        status = 400;
        message = 'Format data tidak valid';
    } else if (errCode === '23505' || rawMessage.includes('duplicate key value') || rawMessage.includes('unique constraint')) {
        status = 400;
        message = 'Data sudah terdaftar atau sudah digunakan';
    } else if (errCode === '23503' || rawMessage.includes('foreign key constraint')) {
        status = 400;
        message = 'Referensi data terkait tidak valid';
    } else if (rawMessage === 'Row not found' || (rawMessage.toLowerCase().includes('not found') && status === 404)) {
        status = 404;
        message = 'Data tidak ditemukan';
    } else if (status === 401) {
        message = (rawMessage && !/syntax|select|insert|update|delete|table|pg_/i.test(rawMessage)) 
            ? rawMessage 
            : 'Akses Ditolak: Autentikasi diperlukan';
    } else if (status === 403) {
        message = (rawMessage && !/syntax|select|insert|update|delete|table|pg_/i.test(rawMessage)) 
            ? rawMessage 
            : 'Akses Ditolak: Anda tidak memiliki izin';
    } else if (status === 404) {
        message = (rawMessage && !/syntax|select|insert|update|delete|table|pg_/i.test(rawMessage)) 
            ? rawMessage 
            : 'Data tidak ditemukan';
    } else if (status === 400) {
        const isSqlLeak = /syntax|select|insert|update|delete|table|column|pg_|relation|uuid/i.test(rawMessage);
        if (rawMessage && !isSqlLeak) {
            message = rawMessage;
        } else {
            message = 'Format data tidak valid';
        }
    } else {
        // HTTP 500 or unknown errors: return generic error message
        status = 500;
        message = 'Terjadi kesalahan pada server. Silakan coba lagi.';
    }

    return NextResponse.json({ error: message }, { status });
}
