import { ComponentFixture, TestBed } from '@angular/core/testing';

import { AjoutDepartement } from './ajout-departement';

describe('AjoutDepartement', () => {
  let component: AjoutDepartement;
  let fixture: ComponentFixture<AjoutDepartement>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AjoutDepartement],
    }).compileComponents();

    fixture = TestBed.createComponent(AjoutDepartement);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
