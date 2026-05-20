import { Injectable, signal } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Observable, catchError, tap, throwError } from 'rxjs';

const API_URL = 'http://192.168.1.142:8080/api';

export interface RoleModel {
  id: number;
  nom: string;
  description?: string;
}

export interface RoleForm {
  nom: string;
  description?: string;
}

@Injectable({ providedIn: 'root' })
export class RoleService {
  private _roles = signal<RoleModel[]>([]);
  roles = this._roles.asReadonly();

  private _loading = signal(false);
  loading = this._loading.asReadonly();

  private _erreur = signal('');
  erreur = this._erreur.asReadonly();

  constructor(private http: HttpClient) {}

  chargerTout(): void {
    this._loading.set(true);
    this._erreur.set('');

    this.http.get<RoleModel[]>(`${API_URL}/roles`).pipe(
      tap((data) => {
        this._roles.set(data);
        this._loading.set(false);
      }),
      catchError((err: HttpErrorResponse) => {
        this._loading.set(false);
        this._erreur.set('Impossible de charger les roles.');
        return throwError(() => err);
      })
    ).subscribe();
  }

  getById(id: number): Observable<RoleModel> {
    return this.http.get<RoleModel>(`${API_URL}/roles/${id}`).pipe(
      catchError((err: HttpErrorResponse) => throwError(() => err))
    );
  }

  creer(data: RoleForm): Observable<RoleModel> {
    return this.http.post<RoleModel>(`${API_URL}/roles`, data).pipe(
      tap((nouveau) => {
        this._roles.update((liste) => [nouveau, ...liste]);
      }),
      catchError((err: HttpErrorResponse) => throwError(() => err))
    );
  }

  modifier(id: number, data: RoleForm): Observable<RoleModel> {
    return this.http.put<RoleModel>(`${API_URL}/roles/${id}`, data).pipe(
      tap((modifie) => {
        this._roles.update((liste) =>
          liste.map((r: RoleModel) => r.id === id ? modifie : r)
        );
      }),
      catchError((err: HttpErrorResponse) => throwError(() => err))
    );
  }

  supprimer(id: number): Observable<void> {
    return this.http.delete<void>(`${API_URL}/roles/${id}`).pipe(
      tap(() => {
        this._roles.update((liste) =>
          liste.filter((r: RoleModel) => r.id !== id)
        );
      }),
      catchError((err: HttpErrorResponse) => throwError(() => err))
    );
  }

  nomExiste(nom: string, idExclu?: number): boolean {
    return this._roles().some((r: RoleModel) =>
      r.nom.toLowerCase() === nom.toLowerCase() && r.id !== idExclu
    );
  }
}
