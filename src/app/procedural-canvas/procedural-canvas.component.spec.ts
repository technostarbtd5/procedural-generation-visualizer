import { async, ComponentFixture, TestBed } from '@angular/core/testing';

import { ProceduralCanvasComponent } from './procedural-canvas.component';

describe('ProceduralCanvasComponent', () => {
  let component: ProceduralCanvasComponent;
  let fixture: ComponentFixture<ProceduralCanvasComponent>;

  beforeEach(async(() => {
    TestBed.configureTestingModule({
      declarations: [ ProceduralCanvasComponent ]
    })
    .compileComponents();
  }));

  beforeEach(() => {
    fixture = TestBed.createComponent(ProceduralCanvasComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
