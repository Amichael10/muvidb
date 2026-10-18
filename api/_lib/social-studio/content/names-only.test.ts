import {expect,it} from 'vitest';
import {namesOnlyCaption} from './names-only';
it('replaces known mentions with names, removes unknown mentions and keeps email addresses',()=>{
 expect(namesOnlyCaption('Cast: @actor.one, @unknown. Contact info@example.com', {topCast:[{name:'Actor One',handle:'@actor.one'}]})).toBe('Cast: Actor One,  Contact info@example.com');
});
