import * as CANNON from 'cannon-es';

export class PhysicsWorld {
  public readonly world: CANNON.World;
  public readonly groundMaterial: CANNON.Material;
  public readonly wheelMaterial: CANNON.Material;
  public readonly chassisMaterial: CANNON.Material;

  constructor() {
    this.world = new CANNON.World({
      gravity: new CANNON.Vec3(0, -28, 0) // Punchy responsive gravity
    });

    this.world.broadphase = new CANNON.SAPBroadphase(this.world);
    (this.world.solver as CANNON.GSSolver).iterations = 10;

    // Materials
    this.groundMaterial = new CANNON.Material('ground');
    this.wheelMaterial = new CANNON.Material('wheel');
    this.chassisMaterial = new CANNON.Material('chassis');

    // Contact material: Wheel & Ground (High grip, low bounce)
    const wheelGroundContact = new CANNON.ContactMaterial(
      this.wheelMaterial,
      this.groundMaterial,
      {
        friction: 0.85,
        restitution: 0.05,
        contactEquationStiffness: 1000
      }
    );
    this.world.addContactMaterial(wheelGroundContact);

    // Contact material: Chassis & Ground
    const chassisGroundContact = new CANNON.ContactMaterial(
      this.chassisMaterial,
      this.groundMaterial,
      {
        friction: 0.4,
        restitution: 0.1
      }
    );
    this.world.addContactMaterial(chassisGroundContact);
  }

  public step(fixedDelta: number): void {
    this.world.step(fixedDelta);
  }
}
