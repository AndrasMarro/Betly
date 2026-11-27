<script lang="ts">
  // Pappkameraden explained in six short films played by the game itself.
  import GuideSteps, { type Step } from './GuideSteps.svelte';
  import TankScene from './TankScene.svelte';
  import { settings } from '../lib/state.svelte';
  let { ondone }: { ondone?: () => void } = $props();
  const L = (a: string, b: string) => (settings.lang === 'de' ? a : b);
  const steps: Step[] = $derived([
    { h: L('Fahren', 'Driving'), scene: s0, p: L('Mit WASD oder den Pfeiltasten fährst du, der Turm folgt der Maus. Am Handy: Stick unten links.', 'WASD or the arrow keys drive, the turret follows the mouse. On a phone: the stick bottom left.') },
    { h: L('Schiessen', 'Shooting'), scene: s1, p: L('Klick schiesst dorthin, wo das Fadenkreuz ist. Höchstens 5 eigene Geschosse gleichzeitig.', 'Click fires where the cross hair is. At most 5 of your shells at once.') },
    { h: L('Abpraller', 'Bank shots'), scene: s2, p: L('Geschosse prallen einmal von Wänden ab. So triffst du um die Ecke, aber pass auf: auch dich selbst.', 'Shells bounce once off walls. That way you hit around corners, but careful: yourself too.') },
    { h: L('Minen', 'Mines'), scene: s3, p: L('Leertaste oder Rechtsklick legt eine Mine. Sie geht hoch, wenn ein Gegner vorbeifährt, wenn man sie anschiesst oder nach 10 Sekunden, und sprengt dünne Kisten weg. Schnell weg!', 'Space or right click lays a mine. It goes off when an enemy rolls by, when shot or after 10 seconds, and blows thin boxes away. Get away fast!') },
    { h: L('Abwehren', 'Blocking'), scene: s4, p: L('Geschosse schiessen sich gegenseitig ab. Schiess einem Geschoss entgegen, das auf dich zukommt.', 'Shells shoot each other down. Fire at a shell that is coming at you.') },
    { h: L('Das Phantom', 'The phantom'), scene: s5, p: L('Manche Gegner werden unsichtbar. Nur ihre Kettenspuren am Boden verraten, wo sie gerade fahren.', 'Some enemies turn invisible. Only their tread marks on the floor show where they are.') },
  ]);
</script>

{#snippet s0()}<TankScene n={0} />{/snippet}
{#snippet s1()}<TankScene n={1} />{/snippet}
{#snippet s2()}<TankScene n={2} />{/snippet}
{#snippet s3()}<TankScene n={3} />{/snippet}
{#snippet s4()}<TankScene n={4} />{/snippet}
{#snippet s5()}<TankScene n={5} />{/snippet}

<GuideSteps {steps} lang={settings.lang} {ondone} />
